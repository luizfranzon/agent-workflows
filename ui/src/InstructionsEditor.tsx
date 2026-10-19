import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { StarterKit } from "@tiptap/starter-kit";

type ToolbarAction = { label: string; title: string; isActive: (editor: Editor) => boolean; run: (editor: Editor) => void };

const TOOLBAR_GROUPS: ToolbarAction[][] = [
  [
    { label: "H1", title: "Título", isActive: (editor) => editor.isActive("heading", { level: 1 }), run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: "H2", title: "Subtítulo", isActive: (editor) => editor.isActive("heading", { level: 2 }), run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "H3", title: "Seção", isActive: (editor) => editor.isActive("heading", { level: 3 }), run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run() },
  ],
  [
    { label: "B", title: "Negrito (Ctrl+B)", isActive: (editor) => editor.isActive("bold"), run: (editor) => editor.chain().focus().toggleBold().run() },
    { label: "I", title: "Itálico (Ctrl+I)", isActive: (editor) => editor.isActive("italic"), run: (editor) => editor.chain().focus().toggleItalic().run() },
    { label: "</>", title: "Código (Ctrl+E)", isActive: (editor) => editor.isActive("code"), run: (editor) => editor.chain().focus().toggleCode().run() },
  ],
  [
    { label: "•", title: "Lista", isActive: (editor) => editor.isActive("bulletList"), run: (editor) => editor.chain().focus().toggleBulletList().run() },
    { label: "1.", title: "Lista numerada", isActive: (editor) => editor.isActive("orderedList"), run: (editor) => editor.chain().focus().toggleOrderedList().run() },
    { label: "❝", title: "Citação", isActive: (editor) => editor.isActive("blockquote"), run: (editor) => editor.chain().focus().toggleBlockquote().run() },
    { label: "{ }", title: "Bloco de código", isActive: (editor) => editor.isActive("codeBlock"), run: (editor) => editor.chain().focus().toggleCodeBlock().run() },
  ],
  [
    { label: "↶", title: "Desfazer (Ctrl+Z)", isActive: () => false, run: (editor) => editor.chain().focus().undo().run() },
    { label: "↷", title: "Refazer (Ctrl+Shift+Z)", isActive: () => false, run: (editor) => editor.chain().focus().redo().run() },
  ],
];

export function InstructionsEditor({ markdown, onChange }: { markdown: string; onChange: (markdown: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit, Markdown, Placeholder.configure({ placeholder: "Descreva o papel do Agente, o que ele lê, o que entrega e como termina." })],
    content: markdown,
    contentType: "markdown",
    editorProps: { attributes: { class: "instructions-editor__content", "aria-label": "Instruções do Agente" } },
    onUpdate: ({ editor: updated }) => onChange(updated.getMarkdown()),
  });
  const activeLabels = useEditorState({
    editor,
    selector: ({ editor: current }) => (current ? TOOLBAR_GROUPS.flat().filter((action) => action.isActive(current)).map((action) => action.label) : []),
  });

  return (
    <div className="instructions-editor">
      <div className="instructions-editor__toolbar" role="toolbar" aria-label="Formatação">
        {TOOLBAR_GROUPS.map((group, index) => (
          <div key={index} className="instructions-editor__group">
            {group.map((action) => (
              <button
                key={action.label}
                type="button"
                title={action.title}
                aria-label={action.title}
                aria-pressed={activeLabels?.includes(action.label) ?? false}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => editor && action.run(editor)}
              >
                {action.label}
              </button>
            ))}
          </div>
        ))}
        <span className="instructions-editor__hint">salvo como markdown</span>
      </div>
      <EditorContent editor={editor} className="instructions-editor__scroll" />
    </div>
  );
}
