'use strict';

var expect = require('expect.js');
var QueueList = require('../src/QueueList');

function makeArrayList(size) {
  var list = [];
  while (list.length < size) {
    list.push({ i: list.length });
  }
  return list;
}

describe('QueueList', function() {

  describe('isEmpty',function() {
    it('should return true when it is empty', function() {
      let list = new QueueList();
      
      expect(list.isEmpty()).to.be(true);
      list.push({});
      expect(list.isEmpty()).to.be(false);

    });
  });

  describe('length', function() {
    it('should be zero is the list is empty', function() {
      let list = new QueueList();

      expect(list.length).to.be(0);
      expect(list.isEmpty()).to.be(true);
    });

    it('should be the number of items in the list', function() {
      let list = new QueueList();

      expect(list.length).to.be(0);
      list.push({});
      expect(list.length).to.be(1);
      list.pop();
      expect(list.length).to.be(0);
    });
  });

  describe('push', function() {
    it('should push objects to the end of the list', function() {
      let list = new QueueList();
      let rearItem1 = { test: 1 };
      let rearItem2 = { test: 2 };

      list.push(rearItem1);
      expect(list.rear).to.be(rearItem1);
      list.push(rearItem2);
      expect(list.rear).to.be(rearItem2);
    });

    it('should not add a repeated item', function() {
      let list = new QueueList();
      let rearItem1 = { test: 1 };

      list.push(rearItem1);
      list.push(rearItem1);
      expect(list.length).to.be(1);
    });
  });

  describe('pop', function() {
    it('should return the last object pushed into the list', function() {
      let list = new QueueList();
      let arrayList = makeArrayList(4);

      list.push({ i: 1 });
      list.push({ i: 2 });
      list.push({ i: 3 });
      list.push({ i: 4 });

      expect(list.pop().i).to.be(4);
      expect(list.pop().i).to.be(3);
      expect(list.pop().i).to.be(2);
      expect(list.pop().i).to.be(1);
    });

    it('should remove the last object pushed into the list', function() {
      let list = new QueueList();
      let arrayList = makeArrayList(4);

      list.push(arrayList[0]);
      list.push(arrayList[1]);
      list.push(arrayList[2]);
      list.push(arrayList[3]);

      list.pop();
      expect(list.asArray()).to.eql([arrayList[0], arrayList[1], arrayList[2]]);
      expect(list.length).to.be(3);
      list.pop();
      expect(list.asArray()).to.eql([arrayList[0], arrayList[1]]);
      expect(list.length).to.be(2);
      list.pop();
      expect(list.asArray()).to.eql([arrayList[0]]);
      expect(list.length).to.be(1);
      list.pop();
      expect(list.asArray()).to.eql([]);
      expect(list.length).to.be(0);
    });
  });

  describe('shift', function() {
    it('should return the first object pushed into the list', function() {
      let list = new QueueList();

      list.push({ i: 1 });
      list.push({ i: 2 });
      list.push({ i: 3 });
      list.push({ i: 4 });

      expect(list.shift().i).to.be(1);
      expect(list.shift().i).to.be(2);
      expect(list.shift().i).to.be(3);
      expect(list.shift().i).to.be(4);
    });

    it('should remove the first object pushed into the list', function() {
      let list = new QueueList();
      let arrayList = makeArrayList(4);

      list.push(arrayList[0]);
      list.push(arrayList[1]);
      list.push(arrayList[2]);
      list.push(arrayList[3]);

      list.shift();
      expect(list.asArray()).to.eql([arrayList[1], arrayList[2], arrayList[3]]);
      expect(list.length).to.be(3);
      list.shift();
      expect(list.asArray()).to.eql([arrayList[2], arrayList[3]]);
      expect(list.length).to.be(2);
      list.shift();
      expect(list.asArray()).to.eql([arrayList[3]]);
      expect(list.length).to.be(1);
      list.shift();
      expect(list.asArray()).to.eql([]);
      expect(list.length).to.be(0);
    });
  });

  describe('unshift', function() {
    it('should push objects to the front of the list', function() {
      let list = new QueueList();
      let rearItem1 = { test: 1 };
      let rearItem2 = { test: 2 };

      list.unshift(rearItem1);
      expect(list.peek).to.be(rearItem1);
      list.unshift(rearItem2);
      expect(list.peek).to.be(rearItem2);
    });

    it('should not add a repeated item', function() {
      let list = new QueueList();
      let rearItem1 = { test: 1 };

      list.unshift(rearItem1);
      list.unshift(rearItem1);

      expect(list.length).to.be(1);
    });
  });

  describe('peek', function() {
    it('should be the first item pushed into the list', function() {
      let list = new QueueList();
      let item1 = { i: 1 };
      let item2 = { i: 2 };

      list.push(item1);
      expect(list.peek).to.be(item1);
      list.push(item2);
      expect(list.peek).to.be(item1);
      list.shift();
      expect(list.peek).to.be(item2);
    });
  });

  describe('rear', function() {
    it('should be the first item pushed into the list', function() {
      let list = new QueueList();
      let item1 = { i: 1 };
      let item2 = { i: 2 };

      list.push(item1);
      expect(list.rear).to.be(item1);
      list.push(item2);
      expect(list.rear).to.be(item2);
    });
  });

  describe('getNext', function() {
    it('should return the next item', function() {
      let list = new QueueList();
      let item1 = { i: 1 };
      let item2 = { i: 2 };
      let item3 = { i: 3 };

      list.push(item1);
      list.push(item2);
      expect(list.getNext(item1)).to.be(item2);
      expect(list.getNext(item2)).to.be(null);
      list.pop();
      list.push(item3);
      expect(list.getNext(item2)).to.be(null);
      expect(list.getNext(item3)).to.be(null);
    });
  });

  describe('getPrevious', function() {
    it('should return the previous item', function() {
      let list = new QueueList();
      let item1 = { i: 1 };
      let item2 = { i: 2 };
      let item3 = { i: 3 };

      list.push(item1);
      list.push(item2);
      expect(list.getPrevious(item1)).to.be(null);
      expect(list.getPrevious(item2)).to.be(item1);
      list.unshift(item3);
      expect(list.getPrevious(item1)).to.be(item3);
    });
  });

  describe('iterator', function() {
    it('should return an iterator object', function() {
      let list = new QueueList();
      let itr = list.iterator();
     
      expect(itr.next).to.be.a('function');
    });

    it('should iterate through all the items in the list', function() {
      var list = new QueueList();
      var itr = list.iterator();
      var arrayList = makeArrayList(10);

      arrayList.forEach((item) => {
        list.push(item);
      });

      let i = 0;
      while (i < 1) {
        let n = itr.next();
        expect(n.value).to.be(arrayList[i]);
        i++;
      }
    });

    it('should iterate in reverse order through all the items in the list', function() {
      var list = new QueueList();
      var itr = list.iterator(true);
      var arrayList = makeArrayList(10);

      arrayList.forEach((item) => {
        list.push(item);
      });

      let i = 9;
      while (i >= 0) {
        let n = itr.next();
        expect(n.value).to.be(arrayList[i]);
        i--;
      }
    });
  });

});