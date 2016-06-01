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
  var tableView = new (class CustomUITableView extends UITableView {

    get scrollingElement() {
      return props.scrollingElement;
    }

    get containerElement() {
      return props.containerElement;
    }

    get contentElement() {
      return props.contentElement || props.scrollingElement;
    }

    get numberOfCells() {
      return props.data.length;
    }
  });

  tableView.data = props.data;
  tableView.getCellElement = props.getCellElement;
  tableView.mount();

  return tableView;
};
