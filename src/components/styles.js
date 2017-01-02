export const styleLayoutHorizontal = `
  display: flex;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
`;

export const inlineLayoutHorizontal = `
  layout-horizontal {
    ${styleLayoutHorizontal}
  }
`;

export const styleLayoutVertical = `
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
`;

export const inlineLayoutVertical = `
  layout-vertical {
    ${styleLayoutVertical}
  }
`;

export const styleItemContainerHorizontal = `
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
`;

export const styleItemContainerTopVertical = `
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
`;

export const styleItemContainerBottomVertical = `
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
`;
