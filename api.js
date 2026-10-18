const API_URL = 'https://jsonplaceholder.typicode.com/posts';

const loadButton = document.querySelector('#load-btn');
const noteForm = document.querySelector('#note-form');
const titleInput = document.querySelector('#title-input');
const bodyInput = document.querySelector('#body-input');
const submitButton = document.querySelector('#submit-btn');
const statusMessage = document.querySelector('#status');
const notesList = document.querySelector('#notes-list');
let activeRequests = 0;

function setButtonsBusy(isBusy) {
  document.querySelectorAll('button').forEach((button) => {
    button.disabled = isBusy;
  });
}

function setStatus(message, kind = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status status-${kind}`;
}

function renderEmptyState() {
  const item = document.createElement('li');
  item.className = 'empty-state';
  item.textContent = 'No notes yet. Load notes or create your first one.';
  notesList.replaceChildren(item);
}

function renderNotes(notes) {
  notesList.replaceChildren();
  if (notes.length === 0) {
    renderEmptyState();
    return;
  }

  for (const note of notes) {
    notesList.append(createNoteCard(note));
  }
}

function createNoteCard(note) {
  const item = document.createElement('li');
  item.className = 'note-card';
  const title = document.createElement('h3');
  title.textContent = note.title;
  const body = document.createElement('p');
  body.textContent = note.body || '';
  const deleteButton = document.createElement('button');
  deleteButton.className = 'button button-delete';
  deleteButton.type = 'button';
  deleteButton.textContent = 'Delete';
  deleteButton.setAttribute('aria-label', `Delete note: ${note.title}`);
  deleteButton.addEventListener('click', () => deleteNote(note.id, item));
  item.append(title, body, deleteButton);
  return item;
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = new Error(`The server returned ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

async function loadNotes() {
  activeRequests += 1;
  setButtonsBusy(true);
  setStatus('Loading notes...', 'loading');
  try {
    const notes = await request(`${API_URL}?_limit=10`);
    renderNotes(notes);
    if (notes.length === 0) {
      setStatus('The server has no notes yet.', 'info');
    } else {
      setStatus(`Loaded ${notes.length} notes from the server.`, 'success');
    }
  } catch (error) {
    setStatus('Sorry, notes could not be loaded. Check your connection and try again.', 'error');
    renderEmptyState();
    console.error('GET notes failed:', error);
  } finally {
    activeRequests -= 1;
    setButtonsBusy(activeRequests > 0);
  }
}

async function createNote(event) {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (!title) {
    titleInput.setCustomValidity('Please enter a title.');
    titleInput.reportValidity();
    titleInput.setCustomValidity('');
    setStatus('A title is required.', 'error');
    titleInput.focus();
    return;
  }
  if (title.length > 100) {
    setStatus('The title must be 100 characters or fewer.', 'error');
    titleInput.focus();
    return;
  }

  activeRequests += 1;
  setButtonsBusy(true);
  setStatus('Creating note...', 'loading');
  try {
    const createdNote = await request(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ title, body, userId: 1 }),
    });
    notesList.querySelector('.empty-state')?.remove();
    notesList.prepend(createNoteCard(createdNote));
    noteForm.reset();
    setStatus(`Note created (status 201, id ${createdNote.id}).`, 'success');
  } catch (error) {
    setStatus('Sorry, your note could not be created. Please try again.', 'error');
    console.error('POST note failed:', error);
  } finally {
    activeRequests -= 1;
    setButtonsBusy(activeRequests > 0);
  }
}

async function deleteNote(noteId, noteElement) {
  activeRequests += 1;
  setButtonsBusy(true);
  setStatus('Deleting note...', 'loading');
  try {
    await request(`${API_URL}/${encodeURIComponent(noteId)}`, { method: 'DELETE' });
    // JSONPlaceholder simulates DELETE but does not persist changes; remove it locally for this session.
    noteElement.remove();
    if (notesList.querySelectorAll('.note-card').length === 0) {
      renderEmptyState();
    }
    setStatus(`Note ${noteId} deleted.`, 'success');
  } catch (error) {
    setStatus('Sorry, that note could not be deleted. Please try again.', 'error');
    console.error('DELETE note failed:', error);
  } finally {
    activeRequests -= 1;
    setButtonsBusy(activeRequests > 0);
  }
}

loadButton.addEventListener('click', loadNotes);
noteForm.addEventListener('submit', createNote);
