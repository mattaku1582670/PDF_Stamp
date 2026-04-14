// overlay.js — ツール状態管理（グローバル名前空間）
var Overlay = (function () {
  var activeTool = 'select';

  return {
    getActiveTool: function () {
      return activeTool;
    },
    setActiveTool: function (tool) {
      activeTool = tool;
      document.querySelectorAll('.page-overlay').forEach(function (el) {
        el.className = 'page-overlay tool-' + tool;
      });
    }
  };
})();
