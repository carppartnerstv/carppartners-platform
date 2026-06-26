'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';

// ─── Botón de la barra de herramientas ───────────────────────────────────────

function ToolBtn({
  onClick, active = false, title, children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className={[
        'inline-flex items-center justify-center w-7 h-7 rounded text-sm select-none transition-all',
        active
          ? 'bg-brand/25 text-brand-bright'
          : 'text-white/50 hover:text-white hover:bg-white/8',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

// ─── Separador de barra ───────────────────────────────────────────────────────

function Sep() {
  return <span className="w-px h-4 bg-white/10 mx-0.5 shrink-0" />;
}

// ─── Editor ──────────────────────────────────────────────────────────────────

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [linkMode, setLinkMode] = useState(false);
  const [linkUrl, setLinkUrl]   = useState('');
  const linkInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false, code: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // Tiptap emite '<p></p>' cuando está vacío; lo normalizamos a ''
      onChange(html === '<p></p>' ? '' : html);
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none text-sm',
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
    },
  });

  // Sincroniza valor externo (cuando se abre el formulario para editar)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = value || '';
    if (current !== incoming && !(current === '<p></p>' && incoming === '')) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [value, editor]);

  // Foco en el input de URL cuando entra en modo link
  useEffect(() => {
    if (linkMode) linkInputRef.current?.focus();
  }, [linkMode]);

  const openLinkMode = () => {
    if (!editor) return;
    const existing = editor.getAttributes('link').href as string | undefined;
    setLinkUrl(existing ?? '');
    setLinkMode(true);
  };

  const applyLink = () => {
    if (!editor) return;
    if (linkUrl.trim()) {
      editor.chain().focus().setLink({ href: linkUrl.trim() }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setLinkMode(false);
    setLinkUrl('');
  };

  const removeLink = () => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
    setLinkMode(false);
    setLinkUrl('');
  };

  if (!editor) return null;

  const isLink = editor.isActive('link');

  return (
    <div className="rounded-md border border-white/12 bg-surface focus-within:border-brand-bright/60 transition-colors overflow-hidden">
      {/* Barra de herramientas */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/8 bg-white/3 flex-wrap">
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')} title="Negrita (Ctrl+B)">
          <strong>B</strong>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')} title="Cursiva (Ctrl+I)">
          <em>I</em>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')} title="Tachado">
          <s>S</s>
        </ToolBtn>

        <Sep />

        <ToolBtn onClick={openLinkMode} active={isLink} title={isLink ? 'Editar enlace' : 'Insertar enlace'}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </ToolBtn>

        <Sep />

        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')} title="Lista con viñetas">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')} title="Lista numerada">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 6h13M7 12h13M7 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        </ToolBtn>
      </div>

      {/* Fila de URL de enlace (cuando está activo) */}
      {linkMode && (
        <div className="flex items-center gap-2 px-3 py-2 bg-white/3 border-b border-white/8">
          <input
            ref={linkInputRef}
            type="url"
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
              if (e.key === 'Escape') { setLinkMode(false); }
            }}
            placeholder="https://…"
            className="flex-1 bg-transparent text-white text-xs outline-none placeholder-white/30"
          />
          <button type="button" onClick={applyLink}
            className="text-[11px] font-semibold text-brand-bright hover:text-white px-2 py-1 rounded hover:bg-white/8 transition-colors">
            OK
          </button>
          {isLink && (
            <button type="button" onClick={removeLink}
              className="text-[11px] text-white/40 hover:text-red-400 px-1 py-1 rounded hover:bg-white/8 transition-colors">
              Quitar
            </button>
          )}
          <button type="button" onClick={() => setLinkMode(false)}
            className="text-[11px] text-white/40 hover:text-white px-1 py-1 rounded hover:bg-white/8 transition-colors">
            ✕
          </button>
        </div>
      )}

      {/* Área de edición */}
      <div className="rich-editor px-3 py-2.5 min-h-[90px]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
