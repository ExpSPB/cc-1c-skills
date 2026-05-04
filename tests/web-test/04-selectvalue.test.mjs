export const name = 'selectValue: dropdown vs форма выбора';
export const tags = ['selectvalue', 'smoke'];
export const timeout = 90000;

const findField = (state, name) => state.fields?.find(f => f.name === name || f.label === name);

export default async function({ navigateSection, openCommand, clickElement, selectValue, closeForm, assert, step, log }) {

  await step('dropdown: Организация → CatalogRef.Организации (quickChoice=true)', async () => {
    await navigateSection('Склад');
    await openCommand('Приходная накладная');
    await clickElement('Создать');

    const result = await selectValue('Организация', 'Альфа');
    log(`method=${result.selected?.method}, search=${result.selected?.search}`);
    assert.equal(result.selected?.method, 'dropdown', 'Должен быть метод dropdown (быстрый выбор)');

    const field = findField(result, 'Организация');
    log(`Организация value='${field?.value}'`);
    assert.includes(field?.value || '', 'Альфа', 'Организация должна показать выбранное значение');

    await closeForm({ save: false });
  });

  await step('direct-form: Контрагент → CatalogRef.Контрагенты (quickChoice=false)', async () => {
    await navigateSection('Склад');
    await openCommand('Приходная накладная');
    await clickElement('Создать');

    const result = await selectValue('Контрагент', 'Север');
    log(`method=${result.selected?.method}, search=${result.selected?.search}`);
    assert.equal(result.selected?.method, 'form', 'Должен быть метод form (через форму выбора)');

    const field = findField(result, 'Контрагент');
    log(`Контрагент value='${field?.value}'`);
    assert.includes(field?.value || '', 'Север', 'Контрагент должен показать выбранное значение');

    await closeForm({ save: false });
  });
}
