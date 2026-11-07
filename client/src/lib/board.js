export function moveBoard(board, id, status, position) {
  const columns = Object.fromEntries(
    Object.entries(board.columns).map(([key, cards]) => [
      key,
      cards.filter((card) => card.id !== id),
    ]),
  );
  const card = Object.values(board.columns)
    .flat()
    .find((item) => item.id === id);
  if (!card || !columns[status]) return board;
  columns[status].splice(Math.min(position, columns[status].length), 0, {
    ...card,
    status,
  });
  const all = Object.values(columns).flat();
  const done = columns.done;
  const points = (items) =>
    items.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
  return {
    ...board,
    columns,
    sprint: {
      ...board.sprint,
      stats: {
        totalTodos: all.length,
        doneTodos: done.length,
        totalPoints: points(all),
        donePoints: points(done),
        byStatus: Object.fromEntries(
          Object.entries(columns).map(([key, items]) => [key, items.length]),
        ),
      },
    },
  };
}
