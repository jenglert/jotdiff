interface NonRepoStateProps {
  cwd: string;
  message: string;
}

export function NonRepoState({ cwd, message }: NonRepoStateProps) {
  return (
    <section className="non-repo-state">
      <div className="non-repo-card">
        <p className="eyebrow">Repository required</p>
        <h2>No git working tree was detected</h2>
        <p>{message}</p>
        <pre>{cwd}</pre>
      </div>
    </section>
  );
}
