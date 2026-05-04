export const name = 'fillFields: text, checkbox, date, dropdown, reference';
export const tags = ['fillfields', 'smoke'];
export const timeout = 60000;

const findField = (state, name) => state.fields?.find(f => f.name === name || f.label === name);

export default async function({ navigateSection, openCommand, clickElement, fillFields, filterList, closeForm, getFormState, assert, step, log }) {

  await step('text+checkbox+date+dropdown: fillFields на Номенклатура', async () => {
    await navigateSection('Склад');
    await openCommand('Номенклатура');
    await clickElement('Товары', { dblclick: true });   // войти в папку
    await clickElement('Товар 01', { dblclick: true });

    const result = await fillFields({
      'Артикул': 'TEST-001',
      'Активен': false,                       // Boolean → CheckBoxField, toggle
      'ДатаПоступления': '15.05.2026',        // date
      'ВидНоменклатуры': 'Услуга',            // EnumRef dropdown
    });

    log('methods: ' + result.filled.map(f => `${f.field}=${f.method}`).join(', '));
    for (const f of result.filled) {
      assert.ok(f.ok, `fillField "${f.field}" должен вернуть ok=true`);
    }

    const state = await getFormState();
    assert.equal(findField(state, 'Артикул')?.value, 'TEST-001', 'Артикул text');
    assert.equal(findField(state, 'Активен')?.value, false, 'Активен checkbox=false');
    assert.equal(findField(state, 'ДатаПоступления')?.value, '15.05.2026', 'ДатаПоступления');
    assert.equal(findField(state, 'ВидНоменклатуры')?.value, 'Услуга', 'ВидНоменклатуры dropdown');

    await closeForm({ save: false });
  });

  await step('reference-dropdown: Организация → CatalogRef.Организации (quickChoice=true)', async () => {
    await navigateSection('Склад');
    await openCommand('Приходная накладная');
    await clickElement('Создать');

    const fillRes = await fillFields({
      'Организация': 'Альфа',
    });
    log('reference method: ' + fillRes.filled[0]?.method);
    assert.ok(fillRes.filled[0]?.ok, 'Организация fillField должна сработать');

    const state = await getFormState();
    const org = findField(state, 'Организация');
    log(`Организация value='${org?.value}'`);
    assert.includes(org?.value || '', 'Альфа', 'Организация должна показать выбранное значение');

    await closeForm({ save: false });
  });

  await step('radio: КатегорияЦены (RadioButtonField, представление RadioButtons)', async () => {
    // Tumbler-представление (СпособУчёта) пока не покрыто — getFormState не
    // возвращает Tumbler в fields[]. См. upload/web-test-bugs.md пункт «radio
    // Tumbler не распознаётся».
    await navigateSection('Склад');
    await openCommand('Номенклатура');
    await filterList('Товар 02');
    await clickElement('Товар 02', { dblclick: true });

    const result = await fillFields({ 'Категория цены': 'Оптовая' });
    log('method: ' + result.filled[0]?.method + ', value: ' + result.filled[0]?.value);
    assert.ok(result.filled[0]?.ok, 'КатегорияЦены fillField должна сработать');
    assert.equal(result.filled[0]?.method, 'radio', 'КатегорияЦены должна использовать method=radio');

    // Note: getFormState().fields для RadioButtonField возвращает value='' —
    // выбранный вариант проще проверить через result.filled[].value.
    assert.includes(result.filled[0]?.value || '', 'Оптовая', 'КатегорияЦены = Оптовая');

    await closeForm({ save: false });
  });
}
