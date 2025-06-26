// 读取CSV内容，生成表格
function loadCSV(url, tableContainerId) {
  fetch(url)
    .then(resp => resp.text())
    .then(csv => {
      const rows = csv.trim().split('\n').map(row => row.split(','));
      let html = '<table><thead><tr>';
      rows[0].forEach(col => html += `<th>${col}</th>`);
      html += '</tr></thead><tbody>';
      rows.slice(1).forEach(row => {
        html += '<tr>';
        row.forEach(cell => html += `<td>${cell}</td>`);
        html += '</tr>';
      });
      html += '</tbody></table>';
      document.getElementById(tableContainerId).innerHTML = html;
    })
    .catch(err => {
      document.getElementById(tableContainerId).innerHTML = '加载失败，请刷新页面重试。';
    });
}

// 下载CSV
document.getElementById('downloadBtn').onclick = function() {
  window.location.href = 'data/investment-table.csv';
};

window.onload = function() {
  loadCSV('data/investment-table.csv', 'table-container');
};
