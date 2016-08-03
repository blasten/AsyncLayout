/**
 * Factory for UITableView
 *
 * Sample usage:
 *
 * ```js
 * UITableView.create({
 *   data: []
 * });
 * ```
 */

'use strict';

module.exports = function factory(props) {
  var tableView = new (class extends UITableView {

    get scrollingElement() {
      return props.scrollingElement;
    }

    get containerElement() {
      return props.containerElement;
    }

    get contentElement() {
      return props.contentElement || props.scrollingElement;
    }

    getNumberOfCellsInSection(secIdx) {
      return props.data[secIdx].items.length;
    }

    get numberOfSections() {
      return props.data.length;
    }

  });

  tableView.data = props.data;
  tableView.getHeaderElement = props.getHeaderElement;
  tableView.getCellElement = props.getCellElement;
  tableView.shouldHeaderStick = props.shouldHeaderStick;
  tableView.mount();

  return tableView;
};
