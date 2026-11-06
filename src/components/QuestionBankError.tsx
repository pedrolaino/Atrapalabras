export function QuestionBankError({ errors }: { errors: string[] }) {
  return (
    <main className="screen screen--centered">
      <div className="card error-panel" role="alert">
        <h1>Hay un problema con las preguntas</h1>
        <p>Corregí estos archivos en <code>src/data/questions/</code> y volvé a cargar la página:</p>
        <ul>
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      </div>
    </main>
  )
}
