function csvToArray(csv) {
  const rows = [];
  const lines = csv.trim().split('\n');
  for (const line of lines) {
    let arr = [];
    let quote = false;
    let cur = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        quote = !quote;
      } else if ((c === ',' || c === '，') && !quote) {
        arr.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    arr.push(cur);
    if (arr.some(cell => cell.trim() !== "")) {
      rows.push(arr);
    }
  }
  return rows;
}

// 千分位格式化函数
function formatNumber(num) {
  if (num === undefined || num === null || num === "") return '';
  let n = Number(num);
  if (isNaN(n)) return num;
  return n.toLocaleString('zh-CN');
}

function createFilterRow(headers, data) {
  const isNumberCol = headers.map((h, idx) => {
    let allNum = true;
    for (let i = 0; i < data.length; ++i) {
      if (isNaN(parseFloat(data[i][idx])) || data[i][idx]==='') {
        allNum = false;
        break;
      }
    }
    return allNum && (headers[idx].includes('金额') || headers[idx].includes('数量'));
  });
  let html = '<tr class="filter-row">';
  headers.forEach((col, idx) => {
    if(isNumberCol[idx]) {
      html += `<th>
        <input type="text" class="filter-num" placeholder="区间/数字" data-idx="${idx}" />
      </th>`;
    } else {
      html += `<th>
        <select class="filter-select" data-idx="${idx}">
          <option value="">全部</option>
        </select>
      </th>`;
    }
  });
  html += '</tr>';
  return html;
}

let g_table_rows = [];
let g_table_headers = [];

function loadCSVToTable(url, containerId) {
  fetch(url)
    .then(resp => resp.text())
    .then(csv => {
      const data = csvToArray(csv);
      const headers = data[0];
      const rows = data.slice(1);
      g_table_headers = headers;
      g_table_rows = rows;

      // 找到金额列
      const moneyIdx = headers.findIndex(h => h.includes('金额'));
      // 生成表格
      let html = `<table id="invest-table" class="display" style="width:100%">
        <thead>
          <tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr>
          ${createFilterRow(headers, rows)}
        </thead>
        <tbody>
          ${rows.map(row=>
            `<tr>${row.map((cell, idx)=>{
              if(idx === moneyIdx && cell) return `<td style="text-align:right;font-weight:bold;color:#d81b60">￥${formatNumber(cell)}</td>`;
              return `<td>${cell}</td>`;
            }).join('')}</tr>`
          ).join('')}
        </tbody>
      </table>`;
      document.getElementById(containerId).innerHTML = html;

      const table = $('#invest-table').DataTable({
        orderCellsTop: true,
        fixedHeader: true,
        language: {
          "sProcessing":   "处理中...",
          "sLengthMenu":   "每页显示 _MENU_ 条",
          "sZeroRecords":  "没有找到匹配的内容",
          "sInfo":         "显示第 _START_ 到 _END_ 条，共 _TOTAL_ 条记录",
          "sInfoEmpty":    "暂无数据",
          "sInfoFiltered": "（已从 _MAX_ 条数据中过滤）",
          "sInfoPostFix":  "",
          "sSearch":       "快速搜索：",
          "sUrl":          "",
          "sEmptyTable":     "表格中没有数据",
          "sLoadingRecords": "数据加载中...",
          "sInfoThousands":  ",",
          "oPaginate": {
              "sFirst":    "首页",
              "sPrevious": "上一页",
              "sNext":     "下一页",
              "sLast":     "末页"
          },
          "oAria": {
              "sSortAscending":  ": 点击按升序排列",
              "sSortDescending": ": 点击按降序排列"
          }
        }
      });

      // 填充下拉选项
      $('#invest-table thead tr.filter-row th select').each(function(){
        let idx = $(this).data('idx');
        let unique = {};
        table.column(idx).data().toArray().forEach(function(d){
          unique[d] = true;
        });
        Object.keys(unique).sort().forEach(v=>{
          if(v !== '') $(this).append(`<option value="${v}">${v}</option>`);
        });
      });

      // 筛选
      $('#invest-table thead').on('change', 'select.filter-select', function(){
        let idx = $(this).data('idx');
        let val = $(this).val();
        table.column(idx).search(val ? '^'+val+'$' : '', true, false).draw();
      });

      $('#invest-table thead').on('input', 'input.filter-num', function(){
        let idx = $(this).data('idx');
        let val = $(this).val().trim();
        $.fn.dataTable.ext.search = $.grep($.fn.dataTable.ext.search, fn => !fn.name || !fn.name.includes('amountFilter'+idx));
        if(val) {
          $.fn.dataTable.ext.search.push(
            function amountFilter(idx) {
              return function(settings, data, dataIndex) {
                // 移除千分位和人民币符号再比较
                const cell = data[idx].replace(/[￥,]/g, '');
                const num = parseFloat(cell);
                if(isNaN(num)) return false;
                if(val.includes('-')) {
                  let [min,max] = val.split('-').map(Number);
                  if(isNaN(min)) min = -Infinity;
                  if(isNaN(max)) max = Infinity;
                  return num >= min && num <= max;
                }
                return num == parseFloat(val);
              }
            }(idx)
          );
        }
        table.draw();
      });
    })
    .catch(err => {
      document.getElementById(containerId).innerHTML = '加载失败，请刷新页面重试。';
    });
}

// Excel导出
document.getElementById('downloadBtn').onclick = function() {
  // 重新读原始数据，去除格式
  const ws_data = [g_table_headers].concat(g_table_rows);
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "投资表");
  XLSX.writeFile(wb, "投资记录.xlsx");
};

window.onload = function() {
  loadCSVToTable('data/my-investments.csv', 'table-container');
};
