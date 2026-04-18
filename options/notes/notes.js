console.log("notes.js loaded");

class NotesManager {
    constructor() {
        this.notes = [];
        this.selectedNoteId = null;
        this.noteInput = document.getElementById("noteInput");
        this.notesList = document.getElementById("notesList");
        this.previewMeta = document.getElementById("previewMeta");
        this.previewContent = document.getElementById("previewContent");
        this.notesCount = document.getElementById("notesCount");
        this.emptyState = document.getElementById("emptyState");
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadNotes();
    }

    bindEvents() {
        document.getElementById("saveBtn").addEventListener("click", () => this.createNote());
        document.getElementById("clearBtn").addEventListener("click", () => {
            this.noteInput.value = "";
            this.noteInput.focus();
        });
        document.getElementById("addBtn").addEventListener("click", () => this.noteInput.focus());
        document.getElementById("exportBtn").addEventListener("click", () => this.exportNotes());

        this.noteInput.addEventListener("keydown", (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                this.createNote();
            }
        });
    }

    loadNotes() {
        chrome.storage.local.get(["quickNotes"], (result) => {
            this.notes = Array.isArray(result.quickNotes) ? result.quickNotes : [];
            this.selectedNoteId = this.notes[0]?.id || null;
            this.render();
        });
    }

    saveNotes() {
        chrome.storage.local.set({ quickNotes: this.notes }, () => {
            if (chrome.runtime.lastError) {
                console.error("Failed to save notes:", chrome.runtime.lastError);
            }
        });
    }

    createNote() {
        const content = this.noteInput.value.trim();
        if (!content) {
            this.noteInput.focus();
            return;
        }

        const now = new Date().toISOString();
        const note = {
            id: Date.now().toString(),
            content,
            createdAt: now,
            updatedAt: now
        };

        this.notes.unshift(note);
        this.selectedNoteId = note.id;
        this.saveNotes();
        this.noteInput.value = "";
        this.render();
        this.noteInput.focus();
    }

    deleteNote(id) {
        const index = this.notes.findIndex((note) => note.id === id);
        if (index === -1) return;

        this.notes.splice(index, 1);
        if (this.selectedNoteId === id) {
            this.selectedNoteId = this.notes[0]?.id || null;
        }
        this.saveNotes();
        this.render();
    }

    copyNote(id) {
        const note = this.notes.find((item) => item.id === id);
        if (!note) return;

        navigator.clipboard.writeText(note.content).catch((error) => {
            console.error("Copy failed:", error);
        });
    }

    selectNote(id) {
        this.selectedNoteId = id;
        this.renderPreview();
        this.renderList();
    }

    exportNotes() {
        if (this.notes.length === 0) return;

        const blob = new Blob([JSON.stringify(this.notes, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `quick-notes-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    render() {
        this.notesCount.textContent = `${this.notes.length} notes`;
        this.emptyState.hidden = this.notes.length !== 0;
        this.renderPreview();
        this.renderList();
    }

    renderPreview() {
        const note = this.notes.find((item) => item.id === this.selectedNoteId);
        if (!note) {
            this.previewMeta.textContent = "还没有选中笔记";
            this.previewContent.className = "preview-content is-empty";
            this.previewContent.textContent = "左侧历史列表会显示最近笔记。点击任意一条可以在这里预览全文。";
            return;
        }

        this.previewMeta.textContent = `${this.formatTime(note.updatedAt || note.createdAt)} · ${note.content.length} chars`;
        this.previewContent.className = "preview-content";
        this.previewContent.textContent = note.content;
    }

    renderList() {
        if (this.notes.length === 0) {
            this.notesList.innerHTML = "";
            return;
        }

        this.notesList.innerHTML = this.notes.map((note) => {
            const selectedClass = note.id === this.selectedNoteId ? " is-selected" : "";
            return `
                <article class="note-card${selectedClass}" data-id="${note.id}">
                    <button class="note-main" type="button" data-action="select" data-id="${note.id}">
                        <div class="note-meta">${this.formatTime(note.updatedAt || note.createdAt)}</div>
                        <div class="note-body">${this.escapeHtml(note.content)}</div>
                    </button>
                    <div class="note-actions">
                        <button class="note-action" type="button" data-action="copy" data-id="${note.id}">复制</button>
                        <button class="note-action danger" type="button" data-action="delete" data-id="${note.id}">删除</button>
                    </div>
                </article>
            `;
        }).join("");

        this.notesList.querySelectorAll("[data-action]").forEach((button) => {
            button.addEventListener("click", (event) => {
                const { action, id } = event.currentTarget.dataset;
                if (action === "select") this.selectNote(id);
                if (action === "copy") this.copyNote(id);
                if (action === "delete") this.deleteNote(id);
            });
        });
    }

    formatTime(isoString) {
        const date = new Date(isoString);
        const diff = Date.now() - date.getTime();

        if (diff < 60 * 1000) return "刚刚";
        if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} 分钟前`;
        if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`;
        if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))} 天前`;

        return date.toLocaleString("zh-CN", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text || "";
        return div.innerHTML;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new NotesManager();
});
