'use strict';

const request = require('@imooc-cli-devp/request')

module.exports = function(){
  return request({
    url: '/project/template'
  })
}