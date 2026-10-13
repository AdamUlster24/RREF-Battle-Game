import './History.css';

export function History({ operations }: { operations: string[] }) {
  return (
    <div className="history">
      <h4>Operations ({operations.length})</h4>
      {operations.length === 0 ? (
        <div className="history-empty">No operations yet</div>
      ) : (
        <ol className="history-list">
          {operations.map((operation, index) => (
            <li key={index} className="history-item">{operation}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
