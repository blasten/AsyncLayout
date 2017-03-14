import { h, Component } from 'preact';
import LayoutVertical from '../../../../src/components/LayoutVertical';

export default class List extends Component {
  render() {
    return (
      <layout-vertical
        props={{
          scrollingElement: document.scrollingElement,
          bottom: true
        }}
      />
    );
  }
}
