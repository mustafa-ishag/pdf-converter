import sys
import json
import openpyxl

def fill_template(template_path, output_path, data_path):
    # قراءة البيانات من ملف JSON
    with open(data_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    items = data.get('items', [])
    wo_number = data.get('woNumber', '')

    # فتح القالب
    wb = openpyxl.load_workbook(template_path)
    ws = wb.active

    # كتابة بيانات المواد
    start_row = 18
    for i, item in enumerate(items):
        row = start_row + i
        ws.cell(row=row, column=2, value=item.get('description', ''))
        ws.cell(row=row, column=9, value=item.get('unit', ''))
        qty = item.get('quantity', 1)
        try:
            qty = float(qty)
        except:
            pass
        ws.cell(row=row, column=10, value=qty)
        ws.cell(row=row, column=13, value=item.get('item_number', ''))

    # كتابة رقم أمر العمل
    for r in range(32, 36):
        ws.cell(row=r, column=7, value=wo_number)

    wb.save(output_path)
    print('OK')

if __name__ == '__main__':
    fill_template(sys.argv[1], sys.argv[2], sys.argv[3])
