import { For } from "solid-js";
import { getHelpDocs } from "./helpDocsRegistry";

export function HelpModule() {
  const docs = getHelpDocs();
  return (
    <section class="module-docs" aria-label="Application help documentation">
      <header class="module-docs-header">
        <h2>Help & Documentation</h2>
        <p>Practical guidance for using the workspace and each module.</p>
      </header>
      <For each={docs}>
        {(doc) => (
          <article class="module-doc-card" data-module={doc.moduleId}>
            <h3>{doc.title}</h3>
            <p>{doc.summary}</p>
            <For each={doc.sections}>
              {(section) => (
                <section class="module-doc-section" id={`help-${doc.moduleId}-${section.id}`}>
                  <h4>{section.title}</h4>
                  <ul>
                    <For each={section.bullets}>{(bullet) => <li>{bullet}</li>}</For>
                  </ul>
                </section>
              )}
            </For>
          </article>
        )}
      </For>
    </section>
  );
}
