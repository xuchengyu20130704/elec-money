function csvToArray(csv) {
  const rows = csv.trim().split('\n').map(line => {
    const regex = /("([^"]|"")*"|[^,]*)/g;
    let match, arr = [], str = line;
    while ((match = regex.exec(str)) !== null) {
      let val = match[0];
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }
      arr.push(val);
      if (str[match.index + val.length] === ',') regex.lastIndex++;
    }
    if (arr.length && arr[arr.length-1] === "") arr.pop();
    return arr;
  });
  return rows;
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

function loadCSVToTable(url, containerId) {
  fetch(url)
    .then(resp => resp.text())
    .then(csv => {
      const data = csvToArray(csv);
      const headers = data[0];
      const rows = data.slice(1);
      let html = `<table id="invest-table" class="display" style="width:100%">
        <thead>
          <tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr>
          ${createFilterRow(headers, rows)}
        </thead>
        <tbody>
          ${rows.map(row=>
            `<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`
          ).join('')}
        </tbody>
      </table>`;
      document.getElementById(containerId).innerHTML = html;

      const table = $('#invest-table').DataTable({
        orderCellsTop: true,
        fixedHeader: true,
        language: {
          url: "https://cdn.datatables.net/plug-ins/1.13.7/i18n/zh-CN.json"
        }
      });

      // 每列唯一选项填充下拉
      $('#invest-table thead tr.filter-row th select').each(function(){
        let idx = $(this).data('idx');
        let unique = {};
        table.column(idx).data().each(function(d){
          unique[d] = true;
        });
        Object.keys(unique).sort().forEach(v=>{
          if(v !== '') $(this).append(`<option value="${v}">${v}</option>`);
        });
      });

      // 字符串列筛选
      $('#invest-table thead').on('change', 'select.filter-select', function(){
        let idx = $(this).data('idx');
        let val = $(this).val();
        table.column(idx).search(val ? '^'+val+'$' : '', true, false).draw();
      });

      // 数字列支持区间和精确
      $('#invest-table thead').on('input', 'input.filter-num', function(){
        let idx = $(this).data('idx');
        let val = $(this).val().trim();
        $.fn.dataTable.ext.search = $.grep($.fn.dataTable.ext.search, fn => !fn.name || !fn.name.includes('amountFilter'+idx));
        if(val) {
          $.fn.dataTable.ext.search.push(
            function amountFilter(idx) {
              return function(settings, data, dataIndex) {
                const cell = data[idx];
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

document.getElementById('downloadBtn').onclick = function() {
  window.location.href = 'data/my-investments.csv';
};

window.onload = function() {
  loadCSVToTable('data/my-investments.csv', 'table-container');
};
