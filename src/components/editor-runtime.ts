import { Compartment, EditorState } from "@codemirror/state";
import {
  EditorView,
  Decoration,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  placeholder,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  bracketMatching,
  indentUnit,
  syntaxHighlighting,
  HighlightStyle,
} from "@codemirror/language";
import { json } from "@codemirror/lang-json";
import { sql, MySQL, PostgreSQL, SQLite } from "@codemirror/lang-sql";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { tags } from "@lezer/highlight";

export interface EditorOptions {
  id: string;
  label: string;
  value: string;
  language: "json" | "sql" | "plain";
  segments?: { text: string; type: string }[];
  dialect?: string;
  indent?: string;
  readOnly?: boolean;
  wrap?: boolean;
  invalid?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
}
const colors = HighlightStyle.define([
  { tag: tags.keyword, color: "#7044b2" },
  { tag: [tags.string, tags.special(tags.string)], color: "#23694d" },
  { tag: [tags.number, tags.bool, tags.null], color: "#a34716" },
  { tag: tags.propertyName, color: "#285ab3" },
  { tag: [tags.comment], color: "#737d8d", fontStyle: "italic" },
  { tag: [tags.operator, tags.punctuation], color: "#596579" },
]);

export function createEditor(parent: HTMLElement, initial: EditorOptions) {
  let options = initial;
  const config = new Compartment();
  const configuration = (o: EditorOptions) => [
    o.value.length > 200_000 || o.language === "plain"
      ? []
      : [
          o.language === "json"
            ? json()
            : sql({
                dialect:
                  o.dialect === "postgresql"
                    ? PostgreSQL
                    : o.dialect === "sqlite"
                      ? SQLite
                      : MySQL,
              }),
          syntaxHighlighting(colors),
          bracketMatching(),
          highlightSelectionMatches(),
        ],
    EditorView.decorations.of(
      Decoration.set(
        (() => {
          let offset = 0;
          return (o.segments || []).flatMap((segment) => {
            const start = offset;
            offset += segment.text.length;
            return segment.type && offset > start && offset <= o.value.length
              ? [
                  Decoration.mark({
                    class: `shot-token-${segment.type}`,
                  }).range(start, offset),
                ]
              : [];
          });
        })(),
      ),
    ),
    indentUnit.of(" ".repeat(Number(o.indent) || 2)),
    EditorState.tabSize.of(Number(o.indent) || 2),
    EditorState.readOnly.of(!!o.readOnly),
    EditorView.editable.of(!o.readOnly),
    o.wrap ? EditorView.lineWrapping : [],
    o.readOnly ? [] : [highlightActiveLine(), highlightActiveLineGutter()],
    placeholder(o.placeholder || ""),
    EditorView.contentAttributes.of({
      id: o.id,
      "aria-label": o.label,
      role: "textbox",
      "aria-multiline": "true",
      "aria-readonly": String(!!o.readOnly),
      "aria-invalid": String(!!o.invalid),
      ...(o.invalid ? { "aria-describedby": "tool-error" } : {}),
      tabindex: "0",
      spellcheck: "false",
    }),
  ];
  const state = (o: EditorOptions) =>
    EditorState.create({
      doc: o.value,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
        ]),
        config.of(configuration(o)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged)
            options.onChange?.(update.state.doc.toString());
        }),
      ],
    });
  const view = new EditorView({ parent, state: state(initial) });
  const key = (o: EditorOptions) =>
    JSON.stringify([
      o.language,
      o.dialect,
      o.indent,
      o.readOnly,
      o.wrap,
      o.invalid,
      o.placeholder,
      o.value.length > 200_000,
    ]);
  return {
    update(next: EditorOptions) {
      const oldKey = key(options);
      const oldSegments = options.segments;
      options = next;
      if (view.state.doc.toString() !== next.value) {
        // Explicit replacement (sample, clear, result) starts a fresh undo history.
        view.setState(state(next));
      } else if (key(next) !== oldKey || oldSegments !== next.segments) {
        view.dispatch({ effects: config.reconfigure(configuration(next)) });
      }
    },
    focus(from: number, to: number) {
      view.dispatch({ selection: { anchor: from, head: to } });
      view.focus();
    },
    destroy() {
      view.destroy();
    },
  };
}
