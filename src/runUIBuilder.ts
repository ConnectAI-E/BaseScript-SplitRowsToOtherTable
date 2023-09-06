import { bitable, FieldType, IOpenSegmentType, IOpenCellValue, checkers } from "@base-open/web-api";
import $ from 'jquery';

let table_id_tmp = localStorage.getItem("table_id_tmp");
const off = bitable.base.onSelectionChange((event) => {
  if (table_id_tmp !== event!.data!.tableId) {
    localStorage.setItem("table_id_tmp", event!.data!.tableId || '');
    window.location.href = window.location.href;
  }
})

export default async function main(uiBuilder: any) {
  uiBuilder.text(`>>>>>查看使用说明<<<<<`),
    uiBuilder.form((form: any) => ({
      formItems: [
        form.tableSelect('tableId_Source', { label: '源数据表' }),
        form.fieldSelect('fieldId', { label: '其它要同步的字段', sourceTable: 'tableId_Source', multiple: true }),
        form.tableSelect('tableId_Target', { label: '目标数据表' }),
        form.checkboxGroup('separater', { label: '分隔符', options: ['换行符', '空格', '#', '\\', '/', '|', ',', ';'], defaultValue: ['换行符'] }),
      ],
      buttons: ['分行到其它表'],
    }), async ({ values }: { values: any }) => {

      const { tableId_Source, fieldId, tableId_Target, separater } = values;
      // console.log(values);

      const getSelection = await bitable.base.getSelection();
      // console.log(getSelection);

      if (!getSelection.fieldId) { alert("请选中要分行的单元格"); return; }

      uiBuilder.showLoading('正在进行数据分行操作...');

      const table_source = await bitable.base.getTableById(tableId_Source as string);
      const table_target = await bitable.base.getTableById(tableId_Target as string);

      const selected_fieldId: any = getSelection!.fieldId;
      const selected_recordId: any = getSelection!.recordId;
      const field_meta = await table_source.getFieldMetaById(selected_fieldId);
      const text_cellvalue: any = await table_source.getCellValue(selected_fieldId, selected_recordId);
      // console.log(1, text_cellvalue);
      // console.log(11, checkers.isLink(text_cellvalue));

      const text_cellstring = await table_source.getCellString(selected_fieldId, selected_recordId);
      // console.log(2, text_cellstring);

      // 根据字段类型进行字符串拆分
      let reg: any = "";
      let reg_str: any = "";
      let text_info: any = text_cellstring;
      let text_list: any = [];
      // let add_field, add_field_id = "";

      switch (field_meta.type) {

        case 1: //Text
          // 根据人工选择的分隔符生成正则表达式
          const new_reg_list: any = [];
          separater.forEach((item: any) => {
            switch (item) {
              case "空格":
                new_reg_list.push(" ");
                break;
              case "换行符":
                new_reg_list.push("\n");
                break;
              case "\\":
                new_reg_list.push("\\\\");
                break;
              case "|":
                new_reg_list.push("\\|");
                break;
              default:
                new_reg_list.push(item);
                break;
            }
          });

          reg_str = new_reg_list.join("|");
          reg = new RegExp(reg_str);

          text_list = text_info.split(reg);
          text_info = text_list.filter(function(item: any) {
            return item && item.trim();
          });
          text_list = text_info;
          break;

        case 19: //Lookup
        case 20: //Formula
          // 自动识别查找引用和公式字段的分隔符并生成正则表达式
          reg_str = ",| ";
          reg = new RegExp(reg_str);

          text_list = text_info.split(reg);
          text_info = text_list.filter(function(item: any) {
            return item && item.trim();
          });
          text_list = text_info;
          break;

        case 4: //MultiSelect
        case 11: //User
          // 自动识别人员和多选字段的分隔符并生成正则表达式
          reg_str = " ";
          reg = new RegExp(reg_str);
          text_list = text_info.split(reg);
          text_info = text_list.filter(function(item: any) {
            return item && item.trim();
          });
          text_list = text_info;
          break;

        case 18: //SingleLink
        case 21: //DuplexLink
          // 自动识别单向关联和双向关联字段的分隔符并生成正则表达式
          reg_str = ",";
          reg = new RegExp(reg_str);
          if (checkers.isLink(text_cellvalue)) text_info = text_cellvalue.text;
          text_list = text_info.split(reg);
          text_info = text_list.filter(function(item: any) {
            return item && item.trim();
          });
          text_list = text_info;
          break;

        default:
          break;
      }
      // console.log(3, text_list);

      let record_items: any = { fields: {} };

      if (typeof fieldId !== 'undefined') {
        const field_metaList = await table_source.getFieldMetaList();

        for (const fieldId_item of fieldId) {
          const curr_cellstring = await table_source.getCellString(fieldId_item, selected_recordId);
          const curr_cellvalue = [{ type: IOpenSegmentType.Text, text: curr_cellstring }];

          for (let meta_index = 0; meta_index < field_metaList.length; meta_index++) {
            if (field_metaList[meta_index].id === fieldId_item) {
              const field_name = field_metaList[meta_index].name;
              try {
                const fieldId_target = await table_target.getFieldByName(field_name);
                record_items.fields[fieldId_target.id] = curr_cellvalue;

              } catch (e) {
                uiBuilder.message.warning('目标表不存在【' + field_name + '】字段');
                return;
              }
            }
          }
        }
      }

      // console.log("curr_record_items: ", record_items);

      let text_list_len = text_list.length;
      let record_value: any = "";
      let selected_fieldId_target: any = "";
      try {
        selected_fieldId_target = await table_target.getFieldByName(field_meta.name);
      } catch (e) {
        uiBuilder.message.warning('目标表不存在【' + field_meta.name + '】字段');
        return;
      }
      for (let i = 0; i < text_list_len; i++) {
        record_value = [{ type: IOpenSegmentType.Text, text: text_list[i] }]
        record_items.fields[selected_fieldId_target.id] = record_value;

        // console.log("update_record_items: ", record_items);
        await table_target.addRecord(record_items);
      }

      uiBuilder.hideLoading();
      uiBuilder.message.success('数据分行完成!');
    });

  // console.log($(".ui-builder-container")[0].firstChild);
  ($(".ui-builder-container")[0].firstChild as HTMLElement).title = `
  本脚本可对文本、多选、人员（多选）、单双向关联、查找引用和公式字段的数据进行拆分并写入到目标数据表的不同行
  1. 操作时在源数据表点击选中要进行数据分行的单元格；
  2. 如需要将额外字段的数据同步到目标表，请选择其它要同步的字段项；
  3. 目标表需要存在与源数据表相同字段名的字段，并且字段格式为多行文本；
  4. 如果源数据表的字段是文本字段，请选择分隔符，其它类型的字段会自动判断分隔符。
  `;

  ($(".ui-builder-container")[0].firstChild as HTMLElement).style.textAlign = "center";
  ($(".ui-builder-container")[0].firstChild as HTMLElement).style!.fontWeight = "bolder";

}
