const invoke = window.__TAURI__?.core?.invoke;
const isTauri = typeof invoke === "function";

const state = {
  contacts: [],
  query: "",
};

const elements = {
  warning: document.querySelector("#warning"),
  error: document.querySelector("#error"),
  dbStatus: document.querySelector("#db-status"),
  contactCount: document.querySelector("#contact-count"),
  filterCount: document.querySelector("#filter-count"),
  search: document.querySelector("#search"),
  contactsBody: document.querySelector("#contacts-body"),
  empty: document.querySelector("#empty"),
  formPanel: document.querySelector("#form-panel"),
  openForm: document.querySelector("#open-form"),
  closeForm: document.querySelector("#close-form"),
  cancelForm: document.querySelector("#cancel-form"),
  form: document.querySelector("#contact-form"),
  name: document.querySelector("#name"),
  email: document.querySelector("#email"),
  phone: document.querySelector("#phone"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "—";

  const normalized = String(value).replace(" ", "T");
  const date = new Date(
    normalized.endsWith("Z") ? normalized : `${normalized}Z`,
  );

  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function initials(name) {
  return String(name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function showError(message) {
  elements.error.textContent = message;
  elements.error.classList.remove("hidden");
}

function hideError() {
  elements.error.classList.add("hidden");
}

function openForm() {
  elements.formPanel.classList.remove("hidden");
  elements.name.focus();
}

function closeForm() {
  elements.formPanel.classList.add("hidden");
  elements.form.reset();
}

function filteredContacts() {
  const query = state.query.trim().toLowerCase();

  if (!query) return state.contacts;

  return state.contacts.filter((contact) =>
    `${contact.name} ${contact.email} ${contact.phone}`
      .toLowerCase()
      .includes(query),
  );
}

function render() {
  const contacts = filteredContacts();

  elements.contactCount.textContent = String(state.contacts.length);
  elements.filterCount.textContent = `${contacts.length} contact${
    contacts.length > 1 ? "s" : ""
  }`;

  elements.contactsBody.innerHTML = contacts
    .map(
      (contact) => `
        <tr>
          <td>
            <div class="contact-cell">
              <span class="contact-avatar">${escapeHtml(initials(contact.name))}</span>
              <strong>${escapeHtml(contact.name)}</strong>
            </div>
          </td>
          <td>${escapeHtml(contact.email)}</td>
          <td>${escapeHtml(contact.phone || "—")}</td>
          <td>${escapeHtml(formatDate(contact.created_at))}</td>
          <td class="actions-column">
            <button class="delete-button" type="button" data-id="${escapeHtml(contact.id)}">
              Supprimer
            </button>
          </td>
        </tr>
      `,
    )
    .join("");

  elements.empty.classList.toggle("hidden", contacts.length > 0);
}

async function loadContacts() {
  if (!isTauri) {
    elements.warning.classList.remove("hidden");
    elements.dbStatus.textContent = "navigateur";
    return;
  }

  const contacts = await invoke("db_select", {
    query:
      "SELECT id, name, email, phone, created_at FROM contacts ORDER BY id DESC",
    params: [],
  });

  state.contacts = Array.isArray(contacts) ? contacts : [];
  render();
}

async function addContact(event) {
  event.preventDefault();
  hideError();

  const name = elements.name.value.trim();
  const email = elements.email.value.trim();
  const phone = elements.phone.value.trim();

  if (!name || !email) {
    showError("Le nom et l'e-mail sont obligatoires.");
    return;
  }

  try {
    await invoke("db_execute", {
      query:
        "INSERT INTO contacts (name, email, phone) VALUES (?1, ?2, ?3)",
      params: [name, email, phone],
    });

    closeForm();
    await loadContacts();
  } catch (error) {
    showError(`Impossible d'ajouter le contact : ${String(error)}`);
  }
}

async function deleteContact(id) {
  if (!window.confirm("Supprimer définitivement ce contact ?")) {
    return;
  }

  hideError();

  try {
    await invoke("db_execute", {
      query: "DELETE FROM contacts WHERE id = ?1",
      params: [Number(id)],
    });

    await loadContacts();
  } catch (error) {
    showError(`Impossible de supprimer le contact : ${String(error)}`);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  elements.openForm.addEventListener("click", openForm);
  elements.closeForm.addEventListener("click", closeForm);
  elements.cancelForm.addEventListener("click", closeForm);
  elements.form.addEventListener("submit", addContact);

  elements.search.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });

  elements.contactsBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-id]");
    if (!button) return;
    deleteContact(button.dataset.id);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeForm();
  });

  loadContacts().catch((error) => {
    showError(`Impossible de charger les contacts : ${String(error)}`);
  });
});
