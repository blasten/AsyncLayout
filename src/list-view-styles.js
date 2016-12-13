export function listViewStyles() {
  return {
    yScrollable: `
      overflow-y: auto;
      overflow-x: hidden;
    `,
    parentContainer: `
      position: relative;
    `,
    itemContainer: `
      position: absolute;
      top: 0px;
      will-change: transform;
    `
  };
}
