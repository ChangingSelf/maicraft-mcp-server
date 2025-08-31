// 全局变量类型定义

declare global {
  var THREE: typeof import('three')
  var Worker: typeof import('worker_threads').Worker
}

export {}

