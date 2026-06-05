const GLOBAL_KEYS = {
  currentProfile: "colegio_current_profile_v1",
  profileCatalog: "colegio_profile_catalog_v1"
};

const PROFILE_BASE_KEYS = {
  assignments: "colegio_assignments_v2",
  chatHistory: "colegio_chat_history_v2",
  chatState: "colegio_chat_state_v2"
};

const DAYS = [
  { value: "lunes", label: "Lunes" },
  { value: "martes", label: "Martes" },
  { value: "miercoles", label: "Miércoles" },
  { value: "jueves", label: "Jueves" },
  { value: "viernes", label: "Viernes" },
  { value: "sabado", label: "Sábado" },
  { value: "domingo", label: "Domingo" }
];

const CHAT_QUESTIONS = [
  {
    key: "mood",
    prompt: "¿Cómo te sientes ahora mismo?",
    options: [
      { value: "tranquilo", label: "Tranquilo/a" },
      { value: "ansioso", label: "Ansioso/a" },
      { value: "triste", label: "Triste" },
      { value: "frustrado", label: "Frustrado/a" }
    ]
  },
  {
    key: "stress",
    prompt: "Del 1 al 5, ¿qué tan estresado/a te sientes? (1 = bajo, 5 = muy alto)",
    options: [
      { value: "1", label: "1" },
      { value: "2", label: "2" },
      { value: "3", label: "3" },
      { value: "4", label: "4" },
      { value: "5", label: "5" }
    ]
  },
  {
    key: "trigger",
    prompt: "¿Qué te está estresando más hoy?",
    options: [
      { value: "estudios", label: "Tareas o exámenes" },
      { value: "tiempo", label: "Falta de tiempo" },
      { value: "social", label: "Relaciones con otras personas" },
      { value: "otro", label: "Otra cosa" }
    ]
  },
  {
    key: "support",
    prompt: "¿Ya hablaste con alguien de confianza sobre esto?",
    options: [
      { value: "si", label: "Sí, ya hablé" },
      { value: "no", label: "No todavía" }
    ]
  }
];

const profileForm = document.getElementById("profile-form");
const profileStatus = document.getElementById("profile-status");
const activeProfileLabel = document.getElementById("active-profile");
const profileCourseSelect = document.getElementById("course");
const studentNameInput = document.getElementById("student-name");

const subjectForm = document.getElementById("subject-form");
const formStatus = document.getElementById("form-status");
const calendarGrid = document.getElementById("calendar-grid");
const submitSubjectButton = document.getElementById("submit-subject");
const cancelEditButton = document.getElementById("cancel-edit");

const chatLog = document.getElementById("chat-log");
const chatOptions = document.getElementById("chat-options");
const restartChatButton = document.getElementById("restart-chat");

let assignments = [];
let editingAssignmentId = null;

let chatHistory = [];
let chatState = {
  step: 0,
  answers: {},
  finished: false
};

let currentProfile = null;
let profileCatalog = readStorage(GLOBAL_KEYS.profileCatalog, []);

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeText(value) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function buildProfile(course, courseLabel, name) {
  const cleanName = name.trim();
  const id = `${normalizeText(course)}_${normalizeText(cleanName)}`;
  return {
    id,
    course,
    courseLabel,
    name: cleanName
  };
}

function getCourseLabel() {
  const selectedOption = profileCourseSelect.options[profileCourseSelect.selectedIndex];
  return selectedOption ? selectedOption.text : "Curso";
}

function getProfileStorageKey(baseKey) {
  return `${baseKey}_${currentProfile.id}`;
}

function setProfileStatus(message) {
  profileStatus.textContent = message;
}

function setCalendarStatus(message) {
  formStatus.textContent = message;
}

function generateId() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function getDefaultChatState() {
  return {
    step: 0,
    answers: {},
    finished: false
  };
}

function upsertProfileCatalog(profile) {
  const exists = profileCatalog.some((item) => item.id === profile.id);
  if (!exists) {
    profileCatalog.push(profile);
    writeStorage(GLOBAL_KEYS.profileCatalog, profileCatalog);
  }
}

function syncProfileInputs(profile) {
  profileCourseSelect.value = profile.course;
  studentNameInput.value = profile.name;
}

function updateActiveProfileLabel() {
  activeProfileLabel.textContent = `Perfil activo: ${currentProfile.courseLabel} - ${currentProfile.name}`;
}

function saveAssignments() {
  writeStorage(getProfileStorageKey(PROFILE_BASE_KEYS.assignments), assignments);
}

function saveChatHistory() {
  writeStorage(getProfileStorageKey(PROFILE_BASE_KEYS.chatHistory), chatHistory);
}

function saveChatState() {
  writeStorage(getProfileStorageKey(PROFILE_BASE_KEYS.chatState), chatState);
}

function loadProfileData() {
  assignments = readStorage(getProfileStorageKey(PROFILE_BASE_KEYS.assignments), []);
  chatHistory = readStorage(getProfileStorageKey(PROFILE_BASE_KEYS.chatHistory), []);
  chatState = readStorage(getProfileStorageKey(PROFILE_BASE_KEYS.chatState), getDefaultChatState());
  editingAssignmentId = null;
  resetForm();
  renderCalendar();
  renderChat();
  if (!chatHistory.length) {
    restartChat();
  } else {
    renderChatOptions();
  }
}

function activateProfile(profile, showStatus) {
  currentProfile = profile;
  writeStorage(GLOBAL_KEYS.currentProfile, currentProfile);
  upsertProfileCatalog(profile);
  syncProfileInputs(profile);
  updateActiveProfileLabel();
  loadProfileData();
  if (showStatus) {
    setProfileStatus(`Perfil cargado: ${profile.courseLabel} - ${profile.name}`);
  }
}

function ensureInitialProfile() {
  const saved = readStorage(GLOBAL_KEYS.currentProfile, null);
  if (saved?.id && saved?.course && saved?.name && saved?.courseLabel) {
    activateProfile(saved, false);
    return;
  }

  const fallback = buildProfile("otro", "Otro", "Invitado");
  activateProfile(fallback, false);
  setProfileStatus("Usando perfil inicial Invitado. Puedes cambiarlo arriba.");
}

function sortAssignments(items) {
  const order = DAYS.reduce((acc, day, index) => {
    acc[day.value] = index;
    return acc;
  }, {});
  return [...items].sort((a, b) => {
    const dayDiff = order[a.day] - order[b.day];
    if (dayDiff !== 0) {
      return dayDiff;
    }
    return a.start.localeCompare(b.start);
  });
}

function renderCalendar() {
  calendarGrid.innerHTML = "";
  const ordered = sortAssignments(assignments);

  DAYS.forEach((day) => {
    const column = document.createElement("article");
    column.className = "day-column";

    const title = document.createElement("h3");
    title.textContent = day.label;
    column.appendChild(title);

    const list = document.createElement("div");
    list.className = "entry-list";

    const items = ordered.filter((entry) => entry.day === day.value);
    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "entry-meta";
      empty.textContent = "Sin asignaturas.";
      list.appendChild(empty);
    } else {
      items.forEach((entry) => {
        const card = document.createElement("div");
        card.className = "entry-card";

        const subject = document.createElement("strong");
        subject.textContent = entry.subject;
        card.appendChild(subject);

        const time = document.createElement("p");
        time.className = "entry-meta";
        time.textContent = `${entry.start} - ${entry.end}`;
        card.appendChild(time);

        if (entry.teacher) {
          const teacher = document.createElement("p");
          teacher.className = "entry-meta";
          teacher.textContent = entry.teacher;
          card.appendChild(teacher);
        }

        if (entry.notes) {
          const notes = document.createElement("p");
          notes.className = "entry-meta";
          notes.textContent = entry.notes;
          card.appendChild(notes);
        }

        const actions = document.createElement("div");
        actions.className = "entry-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "secondary";
        editButton.textContent = "Editar";
        editButton.addEventListener("click", () => startEdit(entry.id));

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "danger";
        deleteButton.textContent = "Eliminar";
        deleteButton.addEventListener("click", () => deleteAssignment(entry.id));

        actions.append(editButton, deleteButton);
        card.appendChild(actions);
        list.appendChild(card);
      });
    }

    column.appendChild(list);
    calendarGrid.appendChild(column);
  });
}

function resetForm() {
  subjectForm.reset();
  editingAssignmentId = null;
  submitSubjectButton.textContent = "Guardar asignatura";
  cancelEditButton.classList.add("hidden");
}

function startEdit(id) {
  const entry = assignments.find((item) => item.id === id);
  if (!entry) {
    return;
  }

  subjectForm.subject.value = entry.subject;
  subjectForm.day.value = entry.day;
  subjectForm.start.value = entry.start;
  subjectForm.end.value = entry.end;
  subjectForm.teacher.value = entry.teacher || "";
  subjectForm.notes.value = entry.notes || "";

  editingAssignmentId = id;
  submitSubjectButton.textContent = "Actualizar asignatura";
  cancelEditButton.classList.remove("hidden");
  setCalendarStatus("Editando asignatura.");
}

function deleteAssignment(id) {
  assignments = assignments.filter((item) => item.id !== id);
  saveAssignments();
  if (editingAssignmentId === id) {
    resetForm();
  }
  renderCalendar();
  setCalendarStatus("Asignatura eliminada.");
}

profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const course = profileCourseSelect.value;
  const name = studentNameInput.value.trim();

  if (!course || !name) {
    setProfileStatus("Completa curso y nombre para usar un perfil.");
    return;
  }

  const profile = buildProfile(course, getCourseLabel(), name);
  activateProfile(profile, true);
});

subjectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const subject = subjectForm.subject.value.trim();
  const day = subjectForm.day.value;
  const start = subjectForm.start.value;
  const end = subjectForm.end.value;
  const teacher = subjectForm.teacher.value.trim();
  const notes = subjectForm.notes.value.trim();

  if (!subject || !day || !start || !end) {
    setCalendarStatus("Completa los campos obligatorios.");
    return;
  }

  if (end <= start) {
    setCalendarStatus("La hora final debe ser mayor que la inicial.");
    return;
  }

  if (editingAssignmentId) {
    assignments = assignments.map((item) =>
      item.id === editingAssignmentId
        ? { ...item, subject, day, start, end, teacher, notes }
        : item
    );
    setCalendarStatus("Asignatura actualizada.");
  } else {
    assignments.push({
      id: generateId(),
      subject,
      day,
      start,
      end,
      teacher,
      notes
    });
    setCalendarStatus("Asignatura guardada.");
  }

  saveAssignments();
  renderCalendar();
  resetForm();
});

cancelEditButton.addEventListener("click", () => {
  resetForm();
  setCalendarStatus("Edición cancelada.");
});

function addChatMessage(role, text) {
  chatHistory.push({ role, text });
  saveChatHistory();
  renderChat();
}

function renderChat() {
  chatLog.innerHTML = "";
  chatHistory.forEach((message) => {
    const bubble = document.createElement("div");
    bubble.className = `bubble ${message.role}`;
    bubble.textContent = message.text;
    chatLog.appendChild(bubble);
  });
  chatLog.scrollTop = chatLog.scrollHeight;
}

function setChatState(newState) {
  chatState = { ...chatState, ...newState };
  saveChatState();
  renderChatOptions();
}

function askCurrentQuestion() {
  const question = CHAT_QUESTIONS[chatState.step];
  if (!question) {
    return;
  }
  addChatMessage("bot", question.prompt);
}

function renderChatOptions() {
  chatOptions.innerHTML = "";

  if (chatState.finished) {
    const breathingButton = document.createElement("button");
    breathingButton.type = "button";
    breathingButton.textContent = "Respiración 4-4-4";
    breathingButton.addEventListener("click", () => {
      addChatMessage("bot", "Haz 4 rondas así:\n1) Inhala 4 segundos.\n2) Mantén 4 segundos.\n3) Exhala 4 segundos.\nHazlo despacio y relaja hombros.");
    });

    const pauseButton = document.createElement("button");
    pauseButton.type = "button";
    pauseButton.textContent = "Pausa activa de 5 minutos";
    pauseButton.addEventListener("click", () => {
      addChatMessage("bot", "Camina 5 minutos, toma agua, estira cuello y espalda. Al volver, elige solo 1 tarea pequeña y empieza por 10 minutos.");
    });

    const restartButton = document.createElement("button");
    restartButton.type = "button";
    restartButton.textContent = "Empezar otra vez";
    restartButton.addEventListener("click", restartChat);

    chatOptions.append(breathingButton, pauseButton, restartButton);
    return;
  }

  const question = CHAT_QUESTIONS[chatState.step];
  if (!question) {
    return;
  }

  question.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option.label;
    button.addEventListener("click", () => handleChatAnswer(option));
    chatOptions.appendChild(button);
  });
}

function getAdvice(answers) {
  const stress = Number(answers.stress?.value || "0");
  const mood = answers.mood?.value;
  const trigger = answers.trigger?.value;
  const support = answers.support?.value;

  const moodTextMap = {
    tranquilo: "Vas por buen camino. Mantener hábitos de descanso y organización te ayudará.",
    ansioso: "Es normal sentir ansiedad en etapas de presión; respirar y ordenar tareas ayuda bastante.",
    triste: "Gracias por expresar cómo te sientes. Hablar y pedir apoyo puede aliviar mucho la carga.",
    frustrado: "La frustración aparece cuando hay mucho encima. Dividir en pasos pequeños suele funcionar."
  };

  const triggerTextMap = {
    estudios: "Prueba estudiar en bloques de 25 minutos con descansos de 5.",
    tiempo: "Haz una lista corta: 3 tareas máximas para hoy, priorizando la más urgente.",
    social: "Es útil hablar con alguien de confianza y expresar lo que te afecta sin guardártelo.",
    otro: "Tomarte 2 minutos para escribir qué te preocupa ayuda a aclarar la mente."
  };

  const supportText = support === "si"
    ? "Muy bien por buscar apoyo."
    : "Te recomiendo hablar hoy con una persona adulta de confianza, tutor/a u orientación escolar.";

  let stressText = "";
  if (stress >= 4) {
    stressText = "Tu nivel de estrés parece alto. Prioriza descansar, hacer una pausa breve y pedir ayuda a un adulto de confianza ahora mismo.";
  } else if (stress === 3) {
    stressText = "Tu estrés es moderado. Con una pausa corta y un plan simple puedes recuperar el control.";
  } else {
    stressText = "Tu nivel de estrés parece manejable. Mantén una rutina equilibrada entre estudio y descanso.";
  }

  const safetyText = stress >= 4
    ? "Si en algún momento te sientes desbordado/a o en peligro, avisa de inmediato a orientación escolar, familia o emergencias de tu localidad."
    : "Recuerda: pedir ayuda a tiempo siempre es una buena decisión.";

  return [
    moodTextMap[mood] || "Gracias por compartir cómo te sientes.",
    triggerTextMap[trigger] || "Tomar una pausa breve puede ayudarte.",
    `${supportText} ${stressText}`,
    safetyText
  ];
}

function handleChatAnswer(option) {
  const question = CHAT_QUESTIONS[chatState.step];
  if (!question) {
    return;
  }

  addChatMessage("user", option.label);
  const answers = {
    ...chatState.answers,
    [question.key]: option
  };

  const nextStep = chatState.step + 1;
  if (nextStep < CHAT_QUESTIONS.length) {
    setChatState({ step: nextStep, answers, finished: false });
    askCurrentQuestion();
    return;
  }

  setChatState({ step: nextStep, answers, finished: true });
  const advice = getAdvice(answers);
  advice.forEach((line) => addChatMessage("bot", line));
}

function restartChat() {
  chatHistory = [];
  chatState = getDefaultChatState();
  saveChatHistory();
  saveChatState();
  addChatMessage("bot", "Hola, estoy aquí para apoyarte. Te haré unas preguntas cortas para ayudarte a sentirte mejor.");
  askCurrentQuestion();
  renderChatOptions();
}

restartChatButton.addEventListener("click", restartChat);
ensureInitialProfile();
