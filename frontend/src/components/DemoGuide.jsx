import '../index.css'

// Example prompts fill the input without sending anything automatically.
const examples = [
  {
    title: 'Explore a customer',
    prompt: 'Find Ahmed Almutairi and show his details.',
  },
  {
    title: 'Save a note and approve it',
    prompt:
      'Save a note for CON-21066: Ahmed requested onboarding support.',
  },
  {
    title: 'Test semantic search',
    prompt:
      'Which customer requested onboarding support? Include the source ID.',
  },
  {
    title: 'Create a task and approve it',
    prompt:
      'Create a task for CON-21066 titled Send revised proposal, due tomorrow.',
  },
]

export default function DemoGuide({ onSelectPrompt, disabled }) {
  return (
    <details className="demo-panel">
      {/* Visitors can expand or collapse this guide. */}
      <summary className="demo-panel__summary">
        About this demo · Data · How to test
      </summary>

      <div className="demo-panel__content">
        <section>
          <h3>What is this?</h3>
          <p>
            An AI CRM assistant that helps you find customers, explore
            business needs, save notes, and manage follow-up tasks through
            conversation. Database changes require your approval.
          </p>
        </section>

        <section>
          <h3>About the CSV dataset</h3>
          <p>
            The demo starts with 120 fictional customer records from{' '}
            <code>saudi_crm_customers_synthetic.csv</code>. Each row
            represents a contact and includes their company, industry, job
            title, sales stage, business needs, recent interaction, and
            next follow-up.
          </p>
          <p>
            The CSV is imported into a SQLite database so the assistant can
            search customer records and check follow-up dates. Notes and
            tasks created during the demo are stored separately in the
            database; they do not change the original CSV.
          </p>
        </section>

        <section>
          <h3>Try it yourself</h3>
          <p className="demo-panel__lead">
            Click a step to fill the message box, then press send.
          </p>

          <ol className="demo-panel__steps">
            {examples.map((example, index) => (
              <li key={example.title}>
                <button
                  type="button"
                  className="demo-step"
                  disabled={disabled}
                  onClick={() => onSelectPrompt(example.prompt)}
                >
                  <span className="demo-step__num" aria-hidden="true">
                    {index + 1}
                  </span>

                  <span className="demo-step__text">
                    <span className="demo-step__title">
                      {example.title}
                    </span>
                    <span className="demo-step__prompt">
                      {example.prompt}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className="demo-panel__disclaimer">
          <h3>Demo disclaimer</h3>
          <p>
            This is a portfolio demonstration, not a production CRM. AI
            responses may contain mistakes. Review answers and proposed
            changes, and do not enter confidential information, passwords,
            or API keys.
          </p>
          <p>
            Free hosting may take about a minute to wake after inactivity.
            Saved chats and demo changes may reset when the server
            restarts. The first semantic search can take longer while the
            index is prepared. Usage limits apply.
          </p>
        </section>
      </div>
    </details>
  )
}