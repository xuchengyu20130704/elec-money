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

function arrayToCSV(arr) {
  return arr.map(row =>
    row.map(cell=>{
      if(cell == null) return '';
      cell = cell.toString();
      if(cell.includes('"')) cell = cell.replace(/"/g, '""');
      if(cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
      return cell;
    }).join(",")
  ).join("\r\n");
}

function arrayToTXT(arr) {
  return arr.map(row =>
    row.join("\t")
  ).join("\r\n");
}

// 动态插入导出格式和文件名选择UI
function insertExportControls() {
  if(document.getElementById('exportCtrlRow')) return;
  let html = `
    <div id="exportCtrlRow" style="margin-bottom:1em;">
      <label>导出文件名: <input id="exportFileName" type="text" value="投资记录" style="width:120px;margin-right:8px;" /></label>
      <label>格式: 
        <select id="exportFormat" style="margin-right:8px;">
          <option value="xlsx">.xlsx</option>
          <option value="xls">.xls</option>
          <option value="csv">.csv</option>
          <option value="txt">.txt</option>
        </select>
      </label>
      <button id="downloadBtn">导出</button>
      <span style="color:#888;font-size:0.95em;margin-left:10px;">导出编码为 UTF-8</span>
    </div>
  `;
  let container = document.getElementById('table-container');
  container.insertAdjacentHTML('beforebegin', html);
}

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
          "sInfo":         "显示第 _START_-_END_ 条，共 _TOTAL_ 条记录",
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
        },
        lengthMenu: [ [10, 25, 50, 100, -1], [10, 25, 50, 100, "全部"] ],
        pageLength: 10
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

      insertExportControls();
      bindExportBtn();
    })
    .catch(err => {
      document.getElementById(containerId).innerHTML = '加载失败，请刷新页面重试。';
    });
}

function bindExportBtn() {
  document.getElementById('downloadBtn').onclick = function() {
    let fileName = document.getElementById('exportFileName').value.trim() || "投资记录";
    let format = document.getElementById('exportFormat').value;
    let ws_data = [g_table_headers].concat(g_table_rows);

    if(format === 'xlsx' || format === 'xls') {
      let ws = XLSX.utils.aoa_to_sheet(ws_data);
      let wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "投资表");
      XLSX.writeFile(wb, fileName + "." + format);
    } else if(format === 'csv') {
      let csv = "\uFEFF" + arrayToCSV(ws_data); // BOM for utf-8
      let blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
      let link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName + ".csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if(format === 'txt') {
      let txt = "\uFEFF" + arrayToTXT(ws_data);
      let blob = new Blob([txt], {type:"text/plain;charset=utf-8;"});
      let link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName + ".txt";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
}

window.onload = function() {
  loadCSVToTable('data/my-investments.csv', 'table-container');
};