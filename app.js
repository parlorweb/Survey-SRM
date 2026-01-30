const STAGES = [
  "Received",
  "Initial Review",
  "County Surveyor Review",
  "Ready for Print",
];

const SURVEYOR_REQUIRED_TYPES = [
  "Partition",
  "Subdivision",
  "Lot Line Adjustment",
];

const storage = {
  get(key, fallback) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const userActions = document.getElementById("user-actions");
const board = document.getElementById("board");
const stageFilter = document.getElementById("stage-filter");
const searchInput = document.getElementById("search");
const newSurveyButton = document.getElementById("new-survey");
const formPanel = document.getElementById("survey-form-panel");
const surveyForm = document.getElementById("survey-form");
const formTitle = document.getElementById("form-title");
const cancelForm = document.getElementById("cancel-form");
const activityLog = document.getElementById("activity-log");

let activeUser = storage.get("activeUser", null);
let editingSurveyId = null;

function renderAuthState() {
  if (activeUser) {
    authSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    userActions.innerHTML = `
      <span>Signed in as ${activeUser.email}</span>
      <button class="secondary" id="sign-out">Sign out</button>
    `;
    document.getElementById("sign-out").addEventListener("click", () => {
      activeUser = null;
      storage.set("activeUser", null);
      renderAuthState();
    });
    renderBoard();
    renderActivity();
  } else {
    authSection.classList.remove("hidden");
    appSection.classList.add("hidden");
    userActions.innerHTML = "";
  }
}

function getSurveys() {
  return storage.get("surveys", []);
}

function setSurveys(surveys) {
  storage.set("surveys", surveys);
}

function getActivity() {
  return storage.get("activity", []);
}

function setActivity(entries) {
  storage.set("activity", entries);
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function addActivityEntry(entry) {
  const entries = getActivity();
  entries.unshift(entry);
  setActivity(entries.slice(0, 50));
}

function renderStageFilter() {
  stageFilter.innerHTML = `
    <option value="">All stages</option>
    ${STAGES.map((stage) => `<option value="${stage}">${stage}</option>`).join("")}
  `;
}

function nextStage(survey) {
  if (survey.stage === "Received") {
    return "Initial Review";
  }
  if (survey.stage === "Initial Review") {
    return SURVEYOR_REQUIRED_TYPES.includes(survey.surveyType)
      ? "County Surveyor Review"
      : "Ready for Print";
  }
  if (survey.stage === "County Surveyor Review") {
    return "Ready for Print";
  }
  return survey.stage;
}

function renderBoard() {
  const surveys = getSurveys();
  const searchTerm = searchInput.value.trim().toLowerCase();
  const stageSelection = stageFilter.value;

  const filtered = surveys.filter((survey) => {
    const matchesSearch =
      !searchTerm ||
      [
        survey.applicantName,
        survey.parcelNumber,
        survey.surveyType,
      ].some((value) => value.toLowerCase().includes(searchTerm));
    const matchesStage = !stageSelection || survey.stage === stageSelection;
    return matchesSearch && matchesStage;
  });

  const grouped = STAGES.reduce((acc, stage) => {
    acc[stage] = filtered.filter((survey) => survey.stage === stage);
    return acc;
  }, {});

  if (filtered.length === 0) {
    board.innerHTML = `
      <div class="empty-state">
        <h3>No surveys found</h3>
        <p>
          ${
            searchTerm || stageSelection
              ? "Try adjusting your search or filters."
              : "Add a new survey to begin tracking review stages."
          }
        </p>
      </div>
    `;
    return;
  }

  board.innerHTML = "";
  STAGES.forEach((stage) => {
    const column = document.createElement("div");
    column.className = "stage-column";
    column.innerHTML = `
      <h3>${stage}</h3>
      <p class="survey-meta">${grouped[stage].length} surveys</p>
    `;
    grouped[stage].forEach((survey) => {
      const card = document.createElement("div");
      card.className = "survey-card";
      const isComplete = survey.stage === "Ready for Print";
      const fileBadge = survey.pdfName
        ? `<span class="file-pill">${survey.pdfName}</span>`
        : `<span class="file-pill empty">No PDF</span>`;
      card.innerHTML = `
        <strong>${survey.applicantName}</strong>
        <p class="survey-meta">${survey.surveyType} • Parcel ${survey.parcelNumber}</p>
        <p class="survey-meta">Submitted ${survey.submittedDate}</p>
        <p>${survey.notes || "No notes"}</p>
        <div class="file-row">
          <span class="survey-meta">File</span>
          ${fileBadge}
        </div>
        <p class="survey-meta">Contact: ${survey.applicantEmail} • ${survey.applicantPhone}</p>
        <div class="survey-actions">
          <button data-action="next" data-id="${survey.id}" ${
            isComplete ? "disabled" : ""
          }>
            ${isComplete ? "Complete" : "Next"}
          </button>
          <button class="secondary" data-action="edit" data-id="${survey.id}">Edit</button>
          <button class="secondary" data-action="delete" data-id="${survey.id}">Delete</button>
        </div>
      `;
      column.appendChild(card);
    });
    board.appendChild(column);
  });
}

function renderActivity() {
  const entries = getActivity();
  if (!entries.length) {
    activityLog.innerHTML = `
      <div class="empty-state compact">
        <h3>No updates yet</h3>
        <p>Stage changes and file updates will appear here.</p>
      </div>
    `;
    return;
  }
  activityLog.innerHTML = entries
    .map(
      (entry) => `
      <div class="activity-item">
        <div>
          <strong>${entry.title}</strong>
          <p class="survey-meta">${entry.detail}</p>
        </div>
        <span class="activity-time">${formatTimestamp(entry.timestamp)}</span>
      </div>
    `
    )
    .join("");
}

function openForm(survey = null) {
  formPanel.classList.remove("hidden");
  if (survey) {
    formTitle.textContent = "Edit survey";
    editingSurveyId = survey.id;
    surveyForm.applicantName.value = survey.applicantName;
    surveyForm.applicantEmail.value = survey.applicantEmail;
    surveyForm.applicantPhone.value = survey.applicantPhone;
    surveyForm.surveyType.value = survey.surveyType;
    surveyForm.parcelNumber.value = survey.parcelNumber;
    surveyForm.submittedDate.value = survey.submittedDate;
    surveyForm.notes.value = survey.notes;
  } else {
    formTitle.textContent = "New survey";
    editingSurveyId = null;
    surveyForm.reset();
  }
}

function closeForm() {
  formPanel.classList.add("hidden");
  surveyForm.reset();
  editingSurveyId = null;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function handleFiles(existingSurvey, surveyData) {
  const pdfFile = surveyForm.surveyPdf.files[0];
  const replaceFile = surveyForm.replacePdf.files[0];
  const fileToUse = replaceFile || pdfFile;

  if (!fileToUse) {
    return existingSurvey;
  }

  if (fileToUse.type !== "application/pdf") {
    alert("Please upload a PDF file.");
    return existingSurvey;
  }

  const pdfDataUrl = await readFileAsDataUrl(fileToUse);
  const updated = {
    ...existingSurvey,
    pdfName: fileToUse.name,
    pdfDataUrl,
    pdfUpdatedAt: new Date().toISOString(),
  };

  addActivityEntry({
    title: `${surveyData.applicantName} updated a PDF`,
    detail: `File: ${fileToUse.name}`,
    timestamp: new Date().toISOString(),
  });

  return updated;
}

async function handleSurveySubmit(event) {
  event.preventDefault();
  const formData = new FormData(surveyForm);
  const surveyData = Object.fromEntries(formData.entries());

  const surveys = getSurveys();

  if (editingSurveyId) {
    const index = surveys.findIndex((survey) => survey.id === editingSurveyId);
    if (index >= 0) {
      const previousStage = surveys[index].stage;
      const updatedSurvey = {
        ...surveys[index],
        ...surveyData,
      };
      surveys[index] = await handleFiles(updatedSurvey, surveyData);
      if (previousStage !== surveys[index].stage) {
        addActivityEntry({
          title: `${surveyData.applicantName} moved stages`,
          detail: `${previousStage} → ${surveys[index].stage}`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  } else {
    const newSurvey = {
      id: crypto.randomUUID(),
      stage: "Received",
      notes: "",
      ...surveyData,
    };
    const updatedSurvey = await handleFiles(newSurvey, surveyData);
    surveys.unshift(updatedSurvey);
    addActivityEntry({
      title: `${surveyData.applicantName} added`,
      detail: `Stage: ${updatedSurvey.stage}`,
      timestamp: new Date().toISOString(),
    });
  }

  setSurveys(surveys);
  closeForm();
  renderBoard();
  renderActivity();
}

function handleBoardClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  const action = button.dataset.action;
  const surveyId = button.dataset.id;
  const surveys = getSurveys();
  const survey = surveys.find((item) => item.id === surveyId);
  if (!survey) {
    return;
  }

  if (action === "next") {
    const previousStage = survey.stage;
    survey.stage = nextStage(survey);
    setSurveys(surveys);
    renderBoard();
    if (survey.stage !== previousStage) {
      addActivityEntry({
        title: `${survey.applicantName} progressed`,
        detail: `${previousStage} → ${survey.stage}`,
        timestamp: new Date().toISOString(),
      });
      renderActivity();
    }
    return;
  }

  if (action === "edit") {
    openForm(survey);
    return;
  }

  if (action === "delete") {
    const confirmed = confirm(
      `Delete the survey for ${survey.applicantName}? This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }
    const updated = surveys.filter((item) => item.id !== surveyId);
    setSurveys(updated);
    renderBoard();
    addActivityEntry({
      title: `${survey.applicantName} deleted`,
      detail: "Survey removed from workflow.",
      timestamp: new Date().toISOString(),
    });
    renderActivity();
  }
}

function registerUser(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const { email, password } = Object.fromEntries(formData.entries());
  const users = storage.get("users", []);

  if (users.some((user) => user.email === email)) {
    alert("An account with that email already exists.");
    return;
  }

  const newUser = { email, password };
  users.push(newUser);
  storage.set("users", users);
  activeUser = newUser;
  storage.set("activeUser", activeUser);
  event.target.reset();
  renderAuthState();
}

function loginUser(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const { email, password } = Object.fromEntries(formData.entries());
  const users = storage.get("users", []);
  const match = users.find(
    (user) => user.email === email && user.password === password
  );

  if (!match) {
    alert("Invalid credentials. Try again.");
    return;
  }

  activeUser = match;
  storage.set("activeUser", activeUser);
  event.target.reset();
  renderAuthState();
}

renderStageFilter();
renderAuthState();
renderActivity();

surveyForm.addEventListener("submit", handleSurveySubmit);
board.addEventListener("click", handleBoardClick);
searchInput.addEventListener("input", renderBoard);
stageFilter.addEventListener("change", renderBoard);
newSurveyButton.addEventListener("click", () => openForm());
cancelForm.addEventListener("click", closeForm);

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
loginForm.addEventListener("submit", loginUser);
registerForm.addEventListener("submit", registerUser);
