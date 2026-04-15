import sys
import json
import openpyxl

def fill_template(template_path, output_path, data_json):
    data = json.loads(data_json)
    items = data.get('items', [])
    wo_number = data.get('woNumber', '')

    # فتح القالب (openpyxl يحافظ على التنسيقات الأصلية)
    wb = openpyxl.load_workbook(template_path)
    ws = wb.active

    # كتابة بيانات المواد (بدءاً من الصف 18)
    start_row = 18
    for i, item in enumerate(items):
        row = start_row + i
        ws.cell(row=row, column=2, value=item.get('description', ''))
        ws.cell(row=row, column=9, value=item.get('unit', ''))
        ws.cell(row=row, column=10, value=item.get('quantity', 1))
        ws.cell(row=row, column=13, value=item.get('item_number', ''))

    # كتابة رقم أمر العمل (الصفوف 32-35)
    for r in range(32, 36):
        ws.cell(row=r, column=7, value=wo_number)

    # حفظ الملف
    wb.save(output_path)
    print(f'Saved: {output_path}')

if __name__ == '__main__':
    template_path = sys.argv[1]
    output_path = sys.argv[2]
    data_json = sys.argv[3]
    fill_template(template_path, output_path, data_json)
