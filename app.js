const STORAGE_KEY = "mk_world_lounge_tracker_v1";

let COURSE_MASTER = [];

const state = {
  currentMogi: null,
  history: [],
};

const elements = {
  mogiStatus: document.getElementById("mogi-status"),
  mogiDate: document.getElementById("mogi-date"),
  participants: document.getElementById("participants"),
  raceInput: document.getElementById("race-input"),
  courseInput: document.getElementById("course-input"),
  courseWarning: document.getElementById("course-warning"),
  addRace: document.getElementById("add-race"),
  mogiAverage: document.getElementById("mogi-average"),
  raceCount: document.getElementById("race-count"),
  usedCourses: document.getElementById("used-courses"),
  raceTable: document.getElementById("race-table"),
  endSection: document.getElementById("end-section"),
  finalRank: document.getElementById("final-rank"),
  saveMogi: document.getElementById("save-mogi"),
  resetMogi: document.getElementById("reset-mogi"),
  saveHint: document.getElementById("save-hint"),
  overallStats: document.getElementById("overall-stats"),
  currentPoints: document.getElementById("current-points"),
  raceStats: document.getElementById("race-stats"),
  historyTable: document.getElementById("history-table"),
  courseStats: document.getElementById("course-stats"),
  exportData: document.getElementById("export-data"),
  importData: document.getElementById("import-data"),
};

const normalizeCourse = (value) => value.trim().toLowerCase();

let courseIndex = {};

const buildCourseIndex = (courses) =>
  courses.reduce((acc, course) => {
    if (!course?.name) {
      return acc;
    }
    acc[normalizeCourse(course.name)] = course;
    const aliases = Array.isArray(course.aliases)
      ? course.aliases
      : typeof course.aliases === "string"
      ? course.aliases.split(",")
      : [];
    aliases.forEach((alias) => {
      const trimmed = String(alias).trim();
      if (trimmed) {
        acc[normalizeCourse(trimmed)] = course;
      }
    });
    return acc;
  }, {});

const loadCourseMaster = async () => {
  let courses = null;

  try {
    const response = await fetch("./course.json", { cache: "no-store" });
    if (response.ok) {
      courses = await response.json();
    }
  } catch {
    courses = null;
  }

  if (!courses) {
    const embedded = document.getElementById("course-data");
    if (embedded?.textContent?.trim()) {
      try {
        courses = JSON.parse(embedded.textContent);
      } catch {
        courses = null;
      }
    }
  }

  if (!Array.isArray(courses)) {
    throw new Error("コースデータの読み込みに失敗しました。");
  }

  COURSE_MASTER = courses;
  courseIndex = buildCourseIndex(COURSE_MASTER);
};

const loadStorage = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      currentMogi: null,
      history: [],
    };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      currentMogi: parsed.currentMogi ?? null,
      history: parsed.history ?? [],
    };
  } catch {
    return {
      currentMogi: null,
      history: [],
    };
  }
};

const validateImportedState = (data) => {
  if (!data || typeof data !== "object") {
    return false;
  }
  if (!Array.isArray(data.history)) {
    return false;
  }
  if (data.currentMogi && typeof data.currentMogi !== "object") {
    return false;
  }
  return true;
};

const handleExportData = () => {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  link.href = url;
  link.download = `mk_world_lounge_backup_${timestamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const handleImportData = (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!validateImportedState(parsed)) {
        alert("インポート形式が不正です。");
        return;
      }
      state.currentMogi = parsed.currentMogi ?? createEmptyMogi();
      state.history = parsed.history ?? [];
      updateAverage();
      saveStorage();
      render();
      alert("インポートしました。");
    } catch {
      alert("JSONの読み込みに失敗しました。");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
};

const saveStorage = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const createEmptyMogi = () => {
  const today = new Date();
  const dateValue = today.toISOString().slice(0, 10);
  return {
    id: crypto.randomUUID(),
    date: dateValue,
    participants: 12,
    races: [],
    finalRank: null,
    averageRank: null,
  };
};

const parseRaceInput = (value) => {
  const parts = value
    .split(/[\/／]/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length !== 2) {
    return { error: "入力形式は X / Y です。" };
  }

  const numbers = parts.map((part) => Number(part));
  if (numbers.some((num) => Number.isNaN(num))) {
    return { error: "数値のみ入力してください。" };
  }

  return {
    raceRank: numbers[0],
    overallRank: numbers[1],
  };
};

const validateRank = (rank, participants) =>
  Number.isInteger(rank) && rank >= 1 && rank <= participants;

const formatAverage = (value) => (value === null ? "-" : value.toFixed(2));
const formatPercent = (value) => (value === null ? "-" : `${value.toFixed(2)}%`);

const getPointsByRank = (rank, participants) => {
  if (participants === 12) {
    const table = {
      1: 15,
      2: 12,
      3: 10,
      4: 9,
      5: 8,
      6: 7,
      7: 6,
      8: 5,
      9: 4,
      10: 3,
      11: 2,
      12: 1,
    };
    return table[rank] ?? 0;
  }

  if (rank === 1) return 15;
  if (rank === 2) return 12;
  if (rank === 3) return 10;
  if (rank === 4 || rank === 5) return 9;
  if (rank === 6 || rank === 7) return 8;
  if (rank === 8 || rank === 9) return 7;
  if (rank >= 10 && rank <= 12) return 6;
  if (rank >= 13 && rank <= 15) return 5;
  if (rank >= 16 && rank <= 18) return 4;
  if (rank >= 19 && rank <= 21) return 3;
  if (rank === 22 || rank === 23) return 2;
  if (rank === 24) return 1;
  return 0;
};

const updateAverage = () => {
  const { races } = state.currentMogi;
  if (races.length === 0) {
    state.currentMogi.averageRank = null;
    return;
  }
  const total = races.reduce((sum, race) => sum + race.raceRank, 0);
  state.currentMogi.averageRank = total / races.length;
};

const getMogiTotalPoints = (mogi) => {
  if (!mogi.races || mogi.races.length === 0) {
    return 0;
  }
  const lastRace = mogi.races[mogi.races.length - 1];
  return Number.isFinite(lastRace.points) ? lastRace.points : 0;
};

const updateCourseWarning = (message = "") => {
  elements.courseWarning.textContent = message;
};

const getCourseByInput = (value) => {
  const raw = value.trim();
  if (!raw) {
    return { course: null };
  }
  if (!Object.keys(courseIndex).length) {
    return { error: "コースデータ未読み込みです。" };
  }

  const isRoad = raw.startsWith("道");
  const lookupValue = isRoad ? raw.slice(1).trim() : raw;
  if (!lookupValue) {
    return { error: "コース名を入力してください。" };
  }

  const normalized = normalizeCourse(lookupValue);
  const course = courseIndex[normalized];
  if (!course) {
    return { error: "未登録のコースです。" };
  }

  if (!isRoad) {
    return { course };
  }

  return {
    course: {
      ...course,
      id: `road:${course.id}`,
      name: `道${course.name}`,
    },
  };
};

const addRace = () => {
  const raceInput = elements.raceInput.value;
  const courseInput = elements.courseInput.value;
  const parsed = parseRaceInput(raceInput);
  if (parsed.error) {
    alert(parsed.error);
    return;
  }

  const participants = Number(elements.participants.value);
  if (!validateRank(parsed.raceRank, participants)) {
    alert("レース順位が参加人数の範囲外です。");
    return;
  }
  if (!validateRank(parsed.overallRank, participants)) {
    alert("総合順位が参加人数の範囲外です。");
    return;
  }
  const courseResult = getCourseByInput(courseInput);
  if (courseResult.error) {
    updateCourseWarning(courseResult.error);
    alert(courseResult.error);
    return;
  }

  if (courseResult.course) {
    const existingCourse = state.currentMogi.races.find(
      (race) => race.courseId === courseResult.course.id
    );
    if (existingCourse) {
      updateCourseWarning("同一模擬内で同じコースは登録できません。");
      alert("同一模擬内で同じコースは登録できません。");
      return;
    }
  }

  if (state.currentMogi.races.length >= 12) {
    alert("12レースに到達しています。");
    return;
  }

  const pointsEarned = getPointsByRank(parsed.raceRank, participants);
  const previousPoints =
    state.currentMogi.races.length === 0
      ? 0
      : state.currentMogi.races[state.currentMogi.races.length - 1].points;
  const cumulativePoints = previousPoints + pointsEarned;

  state.currentMogi.races.push({
    raceNumber: state.currentMogi.races.length + 1,
    raceRank: parsed.raceRank,
    overallRank: parsed.overallRank,
    points: cumulativePoints,
    courseId: courseResult.course ? courseResult.course.id : null,
    courseName: courseResult.course ? courseResult.course.name : null,
  });

  state.currentMogi.participants = participants;
  updateAverage();
  updateCourseWarning();
  elements.raceInput.value = "";
  elements.courseInput.value = "";

  saveStorage();
  render();
};

const handleSaveMogi = () => {
  if (state.currentMogi.races.length !== 12) {
    alert("12レース入力後に保存できます。");
    return;
  }
  const finalRank = Number(elements.finalRank.value);
  const participants = Number(elements.participants.value);
  if (!validateRank(finalRank, participants)) {
    elements.saveHint.textContent = "最終順位が参加人数の範囲外です。";
    return;
  }
  state.currentMogi.finalRank = finalRank;
  updateAverage();

  state.history.unshift({ ...state.currentMogi });
  state.currentMogi = createEmptyMogi();
  elements.saveHint.textContent = "保存しました。";
  saveStorage();
  render();
};

const handleResetMogi = () => {
  const hasInputs =
    state.currentMogi.races.length > 0 ||
    elements.raceInput.value.trim() ||
    elements.courseInput.value.trim();
  if (!hasInputs) {
    alert("リセットする入力がありません。");
    return;
  }
  if (
    !confirm(
      "現在入力中のレースがリセットされます。終了した模擬はリセットされません。\nリセットしますか？"
    )
  ) {
    return;
  }
  state.currentMogi = createEmptyMogi();
  elements.saveHint.textContent = "";
  elements.raceInput.value = "";
  elements.courseInput.value = "";
  updateCourseWarning("");
  saveStorage();
  render();
};

const handleDeleteMogi = (id) => {
  if (!confirm("この模擬を削除しますか？")) {
    return;
  }
  state.history = state.history.filter((mogi) => mogi.id !== id);
  saveStorage();
  render();
};

const computeCourseStats = () => {
  const stats = {};
  state.history.forEach((mogi) => {
    mogi.races.forEach((race) => {
      if (!stats[race.courseId]) {
        stats[race.courseId] = {
          courseName: race.courseName,
          count: 0,
          totalRank: 0,
          best: race.raceRank,
          worst: race.raceRank,
        };
      }
      const entry = stats[race.courseId];
      entry.count += 1;
      entry.totalRank += race.raceRank;
      entry.best = Math.min(entry.best, race.raceRank);
      entry.worst = Math.max(entry.worst, race.raceRank);
    });
  });
  return Object.values(stats).sort((a, b) => b.count - a.count);
};

const computeRaceStatsByParticipants = (participants) => {
  let count = 0;
  let totalRank = 0;
  let best = null;
  let worst = null;
  let wins = 0;

  state.history.forEach((mogi) => {
    if (mogi.participants !== participants) {
      return;
    }
    mogi.races.forEach((race) => {
      count += 1;
      totalRank += race.raceRank;
      best = best === null ? race.raceRank : Math.min(best, race.raceRank);
      worst = worst === null ? race.raceRank : Math.max(worst, race.raceRank);
      if (race.raceRank === 1) {
        wins += 1;
      }
    });
  });

  if (count === 0) {
    return {
      participants,
      count: 0,
      average: null,
      best: null,
      worst: null,
      winRate: null,
    };
  }

  return {
    participants,
    count,
    average: totalRank / count,
    best,
    worst,
    winRate: (wins / count) * 100,
  };
};

const computeOverallStatsByParticipants = (participants) => {
  const mogis = state.history.filter(
    (mogi) => mogi.participants === participants
  );
  if (mogis.length === 0) {
    return {
      participants,
      count: 0,
      averageRank: null,
      averagePoints: null,
    };
  }

  const totalFinalRank = mogis.reduce((sum, mogi) => sum + mogi.finalRank, 0);
  const totalPoints = mogis.reduce(
    (sum, mogi) => sum + getMogiTotalPoints(mogi),
    0
  );

  return {
    participants,
    count: mogis.length,
    averageRank: totalFinalRank / mogis.length,
    averagePoints: totalPoints / mogis.length,
  };
};

const render = () => {
  if (!state.currentMogi) {
    state.currentMogi = createEmptyMogi();
  }

  elements.mogiDate.value = state.currentMogi.date;
  elements.participants.value = String(state.currentMogi.participants);
  elements.raceCount.textContent = `${state.currentMogi.races.length} / 12`;
  elements.mogiAverage.textContent = formatAverage(state.currentMogi.averageRank);
  elements.currentPoints.textContent = String(
    state.currentMogi.races.length === 0
      ? 0
      : state.currentMogi.races[state.currentMogi.races.length - 1].points
  );

  elements.mogiStatus.textContent =
    state.currentMogi.races.length >= 12 ? "終了" : "進行中";
  elements.mogiStatus.style.background =
    state.currentMogi.races.length >= 12 ? "#dcfce7" : "#e0e7ff";
  elements.mogiStatus.style.color =
    state.currentMogi.races.length >= 12 ? "#166534" : "#2563eb";

  elements.usedCourses.innerHTML = "";
  state.currentMogi.races.forEach((race) => {
    if (!race.courseName) {
      return;
    }
    const pill = document.createElement("div");
    pill.className = "pill";
    pill.textContent = race.courseName;
    elements.usedCourses.appendChild(pill);
  });

  elements.raceTable.innerHTML = "";
  state.currentMogi.races.forEach((race) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${race.raceNumber}</td>
      <td>${race.raceRank}</td>
      <td>${race.overallRank}</td>
      <td>${race.points}</td>
      <td>${race.courseName ?? "-"}</td>
    `;
    elements.raceTable.appendChild(row);
  });

  const isComplete = state.currentMogi.races.length === 12;
  elements.endSection.style.display = isComplete ? "flex" : "none";
  elements.saveMogi.disabled = !isComplete;
  elements.finalRank.max = String(state.currentMogi.participants);

  const overallStats = [
    computeOverallStatsByParticipants(12),
    computeOverallStatsByParticipants(24),
  ];
  elements.overallStats.innerHTML = "";
  overallStats.forEach((entry) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${entry.participants}人</td>
      <td>${entry.count}</td>
      <td>${formatAverage(entry.averageRank)}</td>
      <td>${formatAverage(entry.averagePoints)}</td>
    `;
    elements.overallStats.appendChild(row);
  });

  elements.historyTable.innerHTML = "";
  state.history.forEach((mogi) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${mogi.date}</td>
      <td>${mogi.participants}人</td>
      <td>${mogi.finalRank}</td>
      <td>${formatAverage(mogi.averageRank)}</td>
      <td><button class="danger" data-delete="${mogi.id}">削除</button></td>
    `;
    elements.historyTable.appendChild(row);
  });

  elements.historyTable.querySelectorAll("button[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => handleDeleteMogi(btn.dataset.delete));
  });

  const raceStats = [
    computeRaceStatsByParticipants(12),
    computeRaceStatsByParticipants(24),
  ];
  elements.raceStats.innerHTML = "";
  raceStats.forEach((entry) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${entry.participants}人</td>
      <td>${entry.count}</td>
      <td>${formatAverage(entry.average)}</td>
      <td>${entry.best ?? "-"}</td>
      <td>${entry.worst ?? "-"}</td>
      <td>${formatPercent(entry.winRate)}</td>
    `;
    elements.raceStats.appendChild(row);
  });

  const stats = computeCourseStats();
  elements.courseStats.innerHTML = "";
  if (stats.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="5">データがありません。</td>`;
    elements.courseStats.appendChild(row);
  } else {
    stats.forEach((entry) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${entry.courseName}</td>
        <td>${entry.count}</td>
        <td>${formatAverage(entry.totalRank / entry.count)}</td>
        <td>${entry.best}</td>
        <td>${entry.worst}</td>
      `;
      elements.courseStats.appendChild(row);
    });
  }
};

const bindEvents = () => {
  elements.addRace.addEventListener("click", addRace);
  elements.saveMogi.addEventListener("click", handleSaveMogi);
  elements.resetMogi.addEventListener("click", handleResetMogi);
  elements.exportData.addEventListener("click", handleExportData);
  elements.importData.addEventListener("change", handleImportData);

  elements.mogiDate.addEventListener("change", (event) => {
    state.currentMogi.date = event.target.value;
    saveStorage();
  });

  elements.participants.addEventListener("change", (event) => {
    state.currentMogi.participants = Number(event.target.value);
    saveStorage();
    render();
  });

  elements.courseInput.addEventListener("input", () => {
    const value = elements.courseInput.value;
    if (!value.trim()) {
      updateCourseWarning("");
      return;
    }
    const result = getCourseByInput(value);
    updateCourseWarning(result.error ?? "");
  });
};

const init = async () => {
  const stored = loadStorage();
  state.currentMogi = stored.currentMogi ?? createEmptyMogi();
  state.history = stored.history ?? [];
  updateAverage();
  bindEvents();
  try {
    await loadCourseMaster();
  } catch (error) {
    updateCourseWarning(error.message);
    alert(error.message);
  }
  render();
};

init();
