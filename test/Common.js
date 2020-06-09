const { BN, ether } = require('@openzeppelin/test-helpers');

const usdt = (n) => {
  let str = ether(n).toString(10);
  if (str.length <= 12)
    str = '0';
  else
    str = str.substring(0, str.length - 12);
  return new BN(str);
};

module.exports = { 
  usdt, 
  estt: (n) => usdt(n) 
};