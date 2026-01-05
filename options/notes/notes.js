console.log("notes.js loaded");

// 笔记管理器
class NotesManager {
    constructor() {
        this.notes = [];
        this.currentEditId = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadNotes(); // loadNotes 内部会调用 render()
    }

    // 从 chrome.storage.local 加载笔记
    loadNotes() {
        chrome.storage.local.get(['quickNotes'], (result) => {
            this.notes = result.quickNotes || [];
            this.render();
        });
    }

    // 保存笔记到 chrome.storage.local
    saveNotes() {
        chrome.storage.local.set({ quickNotes: this.notes }, () => {
            if (chrome.runtime.lastError) {
                console.error('Failed to save notes:', chrome.runtime.lastError);
                alert('保存失败：' + chrome.runtime.lastError.message);
            }
        });
    }

    // 绑定事件
    bindEvents() {
        // 新建按钮
        document.getElementById('addBtn').addEventListener('click', () => {
            this.openModal();
        });

        // 导出按钮
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportNotes();
        });

        // 弹窗关闭
        document.getElementById('modalClose').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('modalCancel').addEventListener('click', () => {
            this.closeModal();
        });

        // 弹窗保存
        document.getElementById('modalSave').addEventListener('click', () => {
            this.saveNote();
        });

        // 点击遮罩关闭
        document.getElementById('editModal').addEventListener('click', (e) => {
            if (e.target.id === 'editModal') {
                this.closeModal();
            }
        });

        // 编辑器输入监听
        const editor = document.getElementById('editorContent');
        editor.addEventListener('input', () => {
            this.handleEditorInput(editor);
            this.updatePreview();
        });

        // 插入占位符按钮
        document.querySelector('[data-action="insert-placeholder"]').addEventListener('click', () => {
            this.insertPlaceholder();
        });

        // ESC 关闭弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    // 渲染笔记列表
    render() {
        const list = document.getElementById('notesList');
        const emptyState = document.getElementById('emptyState');
        const countEl = document.getElementById('notesCount');

        countEl.textContent = `${this.notes.length} 条笔记`;

        if (this.notes.length === 0) {
            list.innerHTML = '';
            emptyState.classList.add('show');
            return;
        }

        emptyState.classList.remove('show');

        list.innerHTML = this.notes.map(note => `
            <div class="note-item" data-id="${note.id}">
                <div class="note-header">
                    <span class="note-time">${this.formatTime(note.createdAt)}</span>
                    <div class="note-actions">
                        <button class="note-action-btn edit" data-id="${note.id}">编辑</button>
                        <button class="note-action-btn delete" data-id="${note.id}">删除</button>
                        <button class="note-action-btn copy" data-id="${note.id}">复制</button>
                    </div>
                </div>
                <div class="note-content">${this.formatContent(note.content)}</div>
            </div>
        `).join('');

        // 绑定列表项事件
        list.querySelectorAll('.note-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const action = e.target.classList.contains('edit') ? 'edit' :
                              e.target.classList.contains('delete') ? 'delete' : 'copy';

                if (action === 'edit') {
                    this.openModal(id);
                } else if (action === 'delete') {
                    this.deleteNote(id);
                } else if (action === 'copy') {
                    this.copyNote(id);
                }
            });
        });
    }

    // 打开编辑弹窗
    openModal(noteId = null) {
        const modal = document.getElementById('editModal');
        const title = document.getElementById('modalTitle');
        const editor = document.getElementById('editorContent');

        this.currentEditId = noteId;

        if (noteId) {
            title.textContent = '编辑笔记';
            const note = this.notes.find(n => n.id === noteId);
            if (note) {
                editor.innerHTML = this.contentToHtml(note.content);
            }
        } else {
            title.textContent = '新建笔记';
            editor.innerHTML = '';
        }

        this.updatePreview();
        modal.classList.add('show');
        setTimeout(() => editor.focus(), 100);
    }

    // 关闭弹窗
    closeModal() {
        const modal = document.getElementById('editModal');
        modal.classList.remove('show');
        this.currentEditId = null;
    }

    // 保存笔记
    saveNote() {
        const editor = document.getElementById('editorContent');
        const content = this.htmlToContent(editor.innerHTML);

        if (!content.trim()) {
            alert('请输入笔记内容');
            return;
        }

        if (this.currentEditId) {
            // 更新
            const index = this.notes.findIndex(n => n.id === this.currentEditId);
            if (index !== -1) {
                this.notes[index].content = content;
                this.notes[index].updatedAt = new Date().toISOString();
            }
        } else {
            // 新建
            const note = {
                id: Date.now().toString(),
                content: content,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.notes.unshift(note);
        }

        this.saveNotes();
        this.render();
        this.closeModal();
    }

    // 删除笔记
    deleteNote(id) {
        if (!confirm('确定要删除这条笔记吗？')) return;

        const index = this.notes.findIndex(n => n.id === id);
        if (index !== -1) {
            this.notes.splice(index, 1);
            this.saveNotes();
            this.render();
        }
    }

    // 复制笔记
    copyNote(id) {
        const note = this.notes.find(n => n.id === id);
        if (note) {
            navigator.clipboard.writeText(note.content).then(() => {
                alert('已复制到剪贴板');
            }).catch(err => {
                console.error('Copy failed:', err);
                alert('复制失败');
            });
        }
    }

    // 导出笔记
    exportNotes() {
        if (this.notes.length === 0) {
            alert('没有笔记可导出');
            return;
        }

        const dataStr = JSON.stringify(this.notes, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quick-notes-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 处理编辑器输入（转换 00 为色块）
    handleEditorInput(editor) {
        const textContent = editor.textContent;

        if (textContent.includes('00')) {
            const cursorPosition = this.getCaretPosition(editor);
            const newContent = textContent.replace(/00/g, 'PLACEHOLDER');

            editor.innerHTML = '';
            const parts = newContent.split('PLACEHOLDER');

            parts.forEach((part, index) => {
                if (part) {
                    editor.appendChild(document.createTextNode(part));
                }
                if (index < parts.length - 1) {
                    const chip = this.createPlaceholderChip();
                    editor.appendChild(chip);
                }
            });

            this.setCaretPosition(editor, cursorPosition);
        }
    }

    // 创建占位符色块
    createPlaceholderChip() {
        const chip = document.createElement('span');
        chip.className = 'placeholder-chip';
        chip.textContent = '';
        chip.contentEditable = 'false';

        chip.addEventListener('click', () => {
            chip.remove();
        });

        return chip;
    }

    // 插入占位符
    insertPlaceholder() {
        const editor = document.getElementById('editorContent');
        const chip = this.createPlaceholderChip();
        editor.appendChild(chip);
        editor.focus();
        this.updatePreview();
    }

    // 更新预览
    updatePreview() {
        const editor = document.getElementById('editorContent');
        const preview = document.getElementById('previewBox');
        preview.textContent = this.htmlToContent(editor.innerHTML);
    }

    // HTML 内容转为纯文本（色块转为 %s）
    htmlToContent(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;

        let content = '';
        temp.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                content += node.textContent;
            } else if (node.classList && node.classList.contains('placeholder-chip')) {
                content += '%s';
            }
        });

        return content.trim();
    }

    // 纯文本内容转为 HTML（%s 转为色块）
    contentToHtml(content) {
        const parts = content.split(/%s/g);
        const fragments = [];

        parts.forEach((part, index) => {
            if (part) {
                fragments.push(document.createTextNode(part));
            }
            if (index < parts.length - 1) {
                const chip = this.createPlaceholderChip();
                const wrapper = document.createElement('div');
                wrapper.appendChild(chip);
                fragments.push(chip.cloneNode(true));
            }
        });

        const temp = document.createElement('div');
        fragments.forEach(frag => {
            if (frag instanceof HTMLElement) {
                temp.appendChild(frag.cloneNode(true));
            } else {
                temp.appendChild(frag);
            }
        });

        return temp.innerHTML;
    }

    // 格式化内容显示（直接显示 %s 文本）
    formatContent(content) {
        return content;
    }

    // 格式化时间
    formatTime(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;

        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 获取光标位置
    getCaretPosition(element) {
        let caretOffset = 0;
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(element);
            preCaretRange.setEnd(range.endContainer, range.endOffset);
            caretOffset = preCaretRange.toString().length;
        }
        return caretOffset;
    }

    // 设置光标位置
    setCaretPosition(element, position) {
        const range = document.createRange();
        const selection = window.getSelection();

        let charCount = 0;
        let found = false;

        function traverseNodes(node) {
            if (found) return;

            if (node.nodeType === Node.TEXT_NODE) {
                const nextCount = charCount + node.length;
                if (position <= nextCount) {
                    range.setStart(node, position - charCount);
                    range.collapse(true);
                    found = true;
                }
                charCount = nextCount;
            } else {
                for (let i = 0; i < node.childNodes.length && !found; i++) {
                    traverseNodes(node.childNodes[i]);
                }
            }
        }

        traverseNodes(element);

        if (!found) {
            range.selectNodeContents(element);
            range.collapse(false);
        }

        selection.removeAllRanges();
        selection.addRange(range);
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    new NotesManager();
});
