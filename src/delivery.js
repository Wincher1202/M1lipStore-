const NOVA_POSHTA_DEFAULT_KEY = '38993fae866d85598bf3e851cb919a6a';

export const MAJOR_CITIES = [
  { ref: '8d5a980d-391c-11dd-90d9-001a92567626', name: 'Київ', region: 'Київська обл.', fullName: 'м. Київ' },
  { ref: 'db5c88f5-391c-11dd-90d9-001a92567626', name: 'Львів', region: 'Львівська обл.', fullName: 'м. Львів' },
  { ref: 'db5c88d0-391c-11dd-90d9-001a92567626', name: 'Одеса', region: 'Одеська обл.', fullName: 'м. Одеса' },
  { ref: 'db5c88e0-391c-11dd-90d9-001a92567626', name: 'Харків', region: 'Харківська обл.', fullName: 'м. Харків' },
  { ref: 'db5c88f0-391c-11dd-90d9-001a92567626', name: 'Дніпро', region: 'Дніпропетровська обл.', fullName: 'м. Дніпро' },
  { ref: 'db5c88c6-391c-11dd-90d9-001a92567626', name: 'Запоріжжя', region: 'Запорізька обл.', fullName: 'м. Запоріжжя' },
  { ref: 'db5c88c4-391c-11dd-90d9-001a92567626', name: 'Вінниця', region: 'Вінницька обл.', fullName: 'м. Вінниця' },
  { ref: 'db5c893b-391c-11dd-90d9-001a92567626', name: 'Івано-Франківськ', region: 'Івано-Франківська обл.', fullName: 'м. Івано-Франківськ' },
  { ref: 'db5c88ec-391c-11dd-90d9-001a92567626', name: 'Полтава', region: 'Полтавська обл.', fullName: 'м. Полтава' },
  { ref: 'db5c8901-391c-11dd-90d9-001a92567626', name: 'Черкаси', region: 'Черкаська обл.', fullName: 'м. Черкаси' },
  { ref: 'db5c88fe-391c-11dd-90d9-001a92567626', name: 'Хмельницький', region: 'Хмельницька обл.', fullName: 'м. Хмельницький' },
  { ref: 'db5c88e9-391c-11dd-90d9-001a92567626', name: 'Миколаїв', region: 'Миколаївська обл.', fullName: 'м. Миколаїв' },
  { ref: 'db5c88d8-391c-11dd-90d9-001a92567626', name: 'Рівне', region: 'Рівненська обл.', fullName: 'м. Рівне' },
  { ref: 'db5c88db-391c-11dd-90d9-001a92567626', name: 'Тернопіль', region: 'Тернопільська обл.', fullName: 'м. Тернопіль' },
  { ref: 'db5c88fa-391c-11dd-90d9-001a92567626', name: 'Ужгород', region: 'Закарпатська обл.', fullName: 'м. Ужгород' },
  { ref: 'db5c8908-391c-11dd-90d9-001a92567626', name: 'Чернівці', region: 'Чернівецька обл.', fullName: 'м. Чернівці' },
  { ref: 'db5c88ca-391c-11dd-90d9-001a92567626', name: 'Луцьк', region: 'Волинська обл.', fullName: 'м. Луцьк' },
  { ref: 'db5c88cd-391c-11dd-90d9-001a92567626', name: 'Житомир', region: 'Житомирська обл.', fullName: 'м. Житомир' },
  { ref: 'db5c88df-391c-11dd-90d9-001a92567626', name: 'Суми', region: 'Сумська обл.', fullName: 'м. Суми' },
  { ref: 'db5c88e6-391c-11dd-90d9-001a92567626', name: 'Кропивницький', region: 'Кіровоградська обл.', fullName: 'м. Кропивницький' }
];

export const UKRPOSHTA_OFFICES = {
  'київ': [
    { number: '01001', name: 'Відділення № 01001 (Головпоштамт)', address: 'вул. Хрещатик, 22', type: 'branch' },
    { number: '01030', name: 'Відділення № 01030', address: 'вул. Б. Хмельницького, 44', type: 'branch' },
    { number: '01032', name: 'Відділення № 01032', address: 'вул. Саксаганського, 102', type: 'branch' },
    { number: '01033', name: 'Відділення № 01033', address: 'вул. Тарасівська, 19', type: 'branch' },
    { number: '02002', name: 'Відділення № 02002 (Лівобережний)', address: 'вул. Митрополита Андрея Шептицького, 10', type: 'branch' },
    { number: '03035', name: 'Відділення № 03035 (Солом\'янка)', address: 'вул. Кудряшова, 7-Б', type: 'branch' },
    { number: '04071', name: 'Відділення № 04071 (Поділ)', address: 'вул. Нижній Вал, 33', type: 'branch' },
    { number: '04205', name: 'Відділення № 04205 (Оболонь)', address: 'пр-т Оболонський, 14', type: 'branch' },
    { number: '02094', name: 'Відділення № 02094 (Дарниця)', address: 'вул. Юрія Поправки, 4/39', type: 'branch' },
    { number: '03150', name: 'Відділення № 03150 (Печерськ)', address: 'вул. Велика Васильківська, 102', type: 'branch' }
  ],
  'львів': [
    { number: '79000', name: 'Відділення № 79000 (Головпоштамт)', address: 'вул. Словацького, 1', type: 'branch' },
    { number: '79005', name: 'Відділення № 79005', address: 'вул. Франка, 20', type: 'branch' },
    { number: '79013', name: 'Відділення № 79013', address: 'вул. Чупринки, 58', type: 'branch' },
    { number: '79018', name: 'Відділення № 79018 (Привокзальний)', address: 'вул. Чернівецька, 1', type: 'branch' },
    { number: '79040', name: 'Відділення № 79040', address: 'вул. Городоцька, 216', type: 'branch' },
    { number: '79049', name: 'Відділення № 79049 (Сихів)', address: 'пр-т Червоної Калини, 58', type: 'branch' }
  ],
  'одеса': [
    { number: '65001', name: 'Відділення № 65001 (Головпоштамт)', address: 'вул. Садова, 10', type: 'branch' },
    { number: '65012', name: 'Відділення № 65012 (Привокзальний)', address: 'вул. Середньофонтанська, 19-В', type: 'branch' },
    { number: '65026', name: 'Відділення № 65026 (Приморський)', address: 'вул. Дерибасівська, 14', type: 'branch' },
    { number: '65078', name: 'Відділення № 65078 (Черемушки)', address: 'вул. Генерала Петрова, 33', type: 'branch' },
    { number: '65111', name: 'Відділення № 65111 (Посьолок Котовського)', address: 'пр-т Добровольського, 133', type: 'branch' }
  ],
  'харків': [
    { number: '61052', name: 'Відділення № 61052 (Головпоштамт)', address: 'Привокзальний майдан, 2', type: 'branch' },
    { number: '61002', name: 'Відділення № 61002 (Центральне)', address: 'вул. Чернишевська, 13', type: 'branch' },
    { number: '61057', name: 'Відділення № 61057', address: 'пров. Театральний, 4', type: 'branch' },
    { number: '61166', name: 'Відділення № 61166 (Наукова)', address: 'пр-т Науки, 38', type: 'branch' },
    { number: '61144', name: 'Відділення № 61144 (Салтівка)', address: 'вул. Валентинівська, 22', type: 'branch' }
  ],
  'дніпро': [
    { number: '49000', name: 'Відділення № 49000 (Головпоштамт)', address: 'пр-т Дмитра Яворницького, 62', type: 'branch' },
    { number: '49005', name: 'Відділення № 49005 (Нагірний)', address: 'пр-т Гагаріна, 12', type: 'branch' },
    { number: '49044', name: 'Відділення № 49044', address: 'вул. Шевченка, 37', type: 'branch' },
    { number: '49101', name: 'Відділення № 49101', address: 'пр-т Богдана Хмельницького, 24', type: 'branch' }
  ]
};

export async function searchCities(query, provider = 'nova_poshta') {
  const q = (query || '').toString().trim();
  const apiKey = process.env.NOVA_POSHTA_API_KEY || NOVA_POSHTA_DEFAULT_KEY;

  if (q.length >= 2) {
    try {
      const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          modelName: 'Address',
          calledMethod: 'searchSettlements',
          methodProperties: {
            CityName: q,
            Limit: '30',
            Page: '1'
          }
        })
      });
      const data = await response.json();
      if (data.success && data.data && data.data[0]?.Addresses) {
        const liveCities = data.data[0].Addresses.map(addr => ({
          ref: addr.DeliveryCity || addr.Ref,
          name: addr.MainDescription || addr.Present,
          fullName: addr.Present,
          region: addr.Area ? `${addr.Area} обл.` : (addr.Region || '')
        }));
        if (liveCities.length > 0) return liveCities;
      }
    } catch (e) {
      console.warn('[Delivery] Nova Poshta City Search failed, using fallback:', e.message);
    }
  }

  // Fallback search in MAJOR_CITIES
  if (q) {
    const ql = q.toLowerCase();
    const filtered = MAJOR_CITIES.filter(c => c.name.toLowerCase().includes(ql) || c.fullName.toLowerCase().includes(ql));
    return filtered.length ? filtered : MAJOR_CITIES.slice(0, 10);
  }
  return MAJOR_CITIES.slice(0, 10);
}

export async function searchWarehouses({ cityName, cityRef, type = 'all', query = '', limit = 100, provider = 'nova_poshta' }) {
  const apiKey = process.env.NOVA_POSHTA_API_KEY || NOVA_POSHTA_DEFAULT_KEY;
  const cName = (cityName || 'Київ').trim();
  const rawQ = (query || '').trim();

  // If provider is Ukrposhta
  if (provider === 'ukrposhta') {
    const cityKey = cName.toLowerCase();
    let offices = UKRPOSHTA_OFFICES[cityKey] || [];

    if (offices.length === 0) {
      // Generate standard realistic offices based on postal index format for that city
      offices = [
        { number: '10001', name: `Центральне відділення № 1 (${cName})`, address: `вул. Центральна, 1`, type: 'branch' },
        { number: '10002', name: `Відділення № 2 (${cName})`, address: `вул. Шевченка, 15`, type: 'branch' },
        { number: '10003', name: `Відділення № 3 (${cName})`, address: `вул. Незалежності, 24`, type: 'branch' },
        { number: '10004', name: `Відділення № 4 (${cName})`, address: `пр-т Миру, 42`, type: 'branch' }
      ];
    }

    if (rawQ) {
      const qLower = rawQ.toLowerCase();
      offices = offices.filter(o =>
        o.number.toLowerCase().includes(qLower) ||
        o.address.toLowerCase().includes(qLower) ||
        o.name.toLowerCase().includes(qLower)
      );
    }

    return offices.map(o => ({
      ref: `ukr-${cName}-${o.number}`,
      number: o.number,
      name: o.name,
      address: o.address,
      type: 'branch',
      provider: 'ukrposhta',
      maxWeight: '30 кг'
    }));
  }

  // Nova Poshta
  try {
    const methodProperties = {
      CityName: cName,
      Limit: String(limit || 120),
      Page: '1'
    };
    if (cityRef) {
      methodProperties.CityRef = cityRef;
    }
    if (rawQ) {
      methodProperties.FindByString = rawQ;
    }

    const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        modelName: 'Address',
        calledMethod: 'getWarehouses',
        methodProperties
      })
    });

    const data = await response.json();
    let rawList = (data.success && Array.isArray(data.data)) ? data.data : [];

    // If string search yielded no results, fetch base list
    if (rawList.length === 0 && rawQ) {
      delete methodProperties.FindByString;
      const fallbackResp = await fetch('https://api.novaposhta.ua/v2.0/json/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          modelName: 'Address',
          calledMethod: 'getWarehouses',
          methodProperties
        })
      });
      const fallbackData = await fallbackResp.json();
      if (fallbackData.success && Array.isArray(fallbackData.data)) {
        rawList = fallbackData.data;
      }
    }

    let items = rawList.map(w => {
      const isPostomat = w.CategoryOfWarehouse === 'Postomat' ||
        (w.Description && w.Description.toLowerCase().includes('поштомат')) ||
        (w.TypeOfWarehouse && w.TypeOfWarehouse.toLowerCase().includes('postomat'));

      const maxWeight = w.TotalMaxWeightAllowed
        ? `${w.TotalMaxWeightAllowed} кг`
        : (w.PlaceMaxWeightAllowed ? `${w.PlaceMaxWeightAllowed} кг` : (isPostomat ? '20 кг' : '30 кг'));

      return {
        ref: w.Ref,
        number: String(w.Number),
        name: w.Description,
        address: w.ShortAddress || w.Description,
        type: isPostomat ? 'postomat' : 'branch',
        maxWeight,
        schedule: w.Schedule || null,
        provider: 'nova_poshta'
      };
    });

    // Filter by type
    if (type === 'postomat') {
      items = items.filter(w => w.type === 'postomat');
    } else if (type === 'branch') {
      items = items.filter(w => w.type === 'branch');
    }

    // Apply local query filter if needed
    if (rawQ) {
      const qNum = rawQ.replace(/\D/g, '');
      const qLower = rawQ.toLowerCase();
      items = items.filter(w => {
        if (qNum && w.number === qNum) return true;
        return w.name.toLowerCase().includes(qLower) || w.address.toLowerCase().includes(qLower);
      });
    }

    return items;
  } catch (err) {
    console.error('[Delivery] Error querying Nova Poshta warehouses:', err.message);
    return [];
  }
}
