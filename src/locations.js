/**
 * Locations Module
 * Ukrainian oblasts and raions with UIDs from ukrainealarm.com API
 */

export const LOCATIONS = [
    // === OBLASTS ===
    { uid: '3', name: 'Хмельницька область', short: 'Хмельницький', type: 'oblast' },
    { uid: '4', name: 'Вінницька область', short: 'Вінниця обл.', type: 'oblast' },
    { uid: '5', name: 'Рівненська область', short: 'Рівне обл.', type: 'oblast' },
    { uid: '8', name: 'Волинська область', short: 'Волинь обл.', type: 'oblast' },
    { uid: '9', name: 'Дніпропетровська область', short: 'Дніпро обл.', type: 'oblast' },
    { uid: '10', name: 'Житомирська область', short: 'Житомир обл.', type: 'oblast' },
    { uid: '11', name: 'Закарпатська область', short: 'Закарпаття', type: 'oblast' },
    { uid: '12', name: 'Запорізька область', short: 'Запоріжжя обл.', type: 'oblast' },
    { uid: '13', name: 'Івано-Франківська область', short: 'Ів-Франківськ', type: 'oblast' },
    { uid: '14', name: 'Київська область', short: 'Київ обл.', type: 'oblast' },
    { uid: '15', name: 'Кіровоградська область', short: 'Кропивницький', type: 'oblast' },
    { uid: '16', name: 'Луганська область', short: 'Луганськ обл.', type: 'oblast' },
    { uid: '17', name: 'Миколаївська область', short: 'Миколаїв обл.', type: 'oblast' },
    { uid: '18', name: 'Одеська область', short: 'Одеса обл.', type: 'oblast' },
    { uid: '19', name: 'Полтавська область', short: 'Полтава обл.', type: 'oblast' },
    { uid: '20', name: 'Сумська область', short: 'Суми обл.', type: 'oblast' },
    { uid: '21', name: 'Тернопільська область', short: 'Тернопіль обл.', type: 'oblast' },
    { uid: '22', name: 'Харківська область', short: 'Харків обл.', type: 'oblast' },
    { uid: '23', name: 'Херсонська область', short: 'Херсон обл.', type: 'oblast' },
    { uid: '24', name: 'Черкаська область', short: 'Черкаси обл.', type: 'oblast' },
    { uid: '25', name: 'Чернігівська область', short: 'Чернігів обл.', type: 'oblast' },
    { uid: '26', name: 'Чернівецька область', short: 'Чернівці обл.', type: 'oblast' },
    { uid: '27', name: 'Львівська область', short: 'Львів обл.', type: 'oblast' },
    { uid: '28', name: 'Донецька область', short: 'Донецьк обл.', type: 'oblast' },
    { uid: '31', name: 'м. Київ', short: 'Київ', type: 'city' },

    // === RAIONS ===
    // Хмельницька (3)
    { uid: '134', name: 'Хмельницький район', short: 'Хмельницький р-н', type: 'raion', oblastUid: '3' },
    { uid: '135', name: "Кам'янець-Подільський район", short: "Кам'янець р-н", type: 'raion', oblastUid: '3' },
    { uid: '136', name: 'Шепетівський район', short: 'Шепетівка р-н', type: 'raion', oblastUid: '3' },

    // Вінницька (4)
    { uid: '32', name: 'Тульчинський район', short: 'Тульчин р-н', type: 'raion', oblastUid: '4' },
    { uid: '33', name: 'Могилів-Подільський район', short: 'Могилів-Под. р-н', type: 'raion', oblastUid: '4' },
    { uid: '34', name: 'Хмільницький район', short: 'Хмільник р-н', type: 'raion', oblastUid: '4' },
    { uid: '35', name: 'Жмеринський район', short: 'Жмеринка р-н', type: 'raion', oblastUid: '4' },
    { uid: '36', name: 'Вінницький район', short: 'Вінниця р-н', type: 'raion', oblastUid: '4' },
    { uid: '37', name: 'Гайсинський район', short: 'Гайсин р-н', type: 'raion', oblastUid: '4' },

    // Рівненська (5)
    { uid: '110', name: 'Вараський район', short: 'Вараш р-н', type: 'raion', oblastUid: '5' },
    { uid: '111', name: 'Дубенський район', short: 'Дубно р-н', type: 'raion', oblastUid: '5' },
    { uid: '112', name: 'Рівненський район', short: 'Рівне р-н', type: 'raion', oblastUid: '5' },
    { uid: '113', name: 'Сарненський район', short: 'Сарни р-н', type: 'raion', oblastUid: '5' },

    // Волинська (8)
    { uid: '38', name: 'Володимир-Волинський район', short: 'Володимир р-н', type: 'raion', oblastUid: '8' },
    { uid: '39', name: 'Луцький район', short: 'Луцьк р-н', type: 'raion', oblastUid: '8' },
    { uid: '40', name: 'Ковельський район', short: 'Ковель р-н', type: 'raion', oblastUid: '8' },
    { uid: '41', name: 'Камінь-Каширський район', short: 'Камінь-Каш. р-н', type: 'raion', oblastUid: '8' },

    // Дніпропетровська (9)
    { uid: '42', name: "Кам'янський район", short: "Кам'янське р-н", type: 'raion', oblastUid: '9' },
    { uid: '43', name: 'Новомосковський район', short: 'Новомосковськ р-н', type: 'raion', oblastUid: '9' },
    { uid: '44', name: 'Дніпровський район', short: 'Дніпро р-н', type: 'raion', oblastUid: '9' },
    { uid: '45', name: 'Павлоградський район', short: 'Павлоград р-н', type: 'raion', oblastUid: '9' },
    { uid: '46', name: 'Криворізький район', short: 'Кривий Ріг р-н', type: 'raion', oblastUid: '9' },
    { uid: '47', name: 'Нікопольський район', short: 'Нікополь р-н', type: 'raion', oblastUid: '9' },
    { uid: '48', name: 'Синельниківський район', short: 'Синельникове р-н', type: 'raion', oblastUid: '9' },

    // Житомирська (10)
    { uid: '57', name: 'Бердичівський район', short: 'Бердичів р-н', type: 'raion', oblastUid: '10' },
    { uid: '58', name: 'Коростенський район', short: 'Коростень р-н', type: 'raion', oblastUid: '10' },
    { uid: '59', name: 'Житомирський район', short: 'Житомир р-н', type: 'raion', oblastUid: '10' },
    { uid: '60', name: 'Звягельський район', short: 'Звягель р-н', type: 'raion', oblastUid: '10' },

    // Закарпатська (11)
    { uid: '61', name: 'Берегівський район', short: 'Берегово р-н', type: 'raion', oblastUid: '11' },
    { uid: '62', name: 'Хустський район', short: 'Хуст р-н', type: 'raion', oblastUid: '11' },
    { uid: '63', name: 'Рахівський район', short: 'Рахів р-н', type: 'raion', oblastUid: '11' },
    { uid: '64', name: 'Тячівський район', short: 'Тячів р-н', type: 'raion', oblastUid: '11' },
    { uid: '65', name: 'Мукачівський район', short: 'Мукачево р-н', type: 'raion', oblastUid: '11' },
    { uid: '66', name: 'Ужгородський район', short: 'Ужгород р-н', type: 'raion', oblastUid: '11' },

    // Запорізька (12)
    { uid: '145', name: 'Пологівський район', short: 'Пологи р-н', type: 'raion', oblastUid: '12' },
    { uid: '146', name: 'Василівський район', short: 'Василівка р-н', type: 'raion', oblastUid: '12' },
    { uid: '147', name: 'Бердянський район', short: 'Бердянськ р-н', type: 'raion', oblastUid: '12' },
    { uid: '148', name: 'Мелітопольський район', short: 'Мелітополь р-н', type: 'raion', oblastUid: '12' },
    { uid: '149', name: 'Запорізький район', short: 'Запоріжжя р-н', type: 'raion', oblastUid: '12' },

    // Івано-Франківська (13)
    { uid: '67', name: 'Верховинський район', short: 'Верховина р-н', type: 'raion', oblastUid: '13' },
    { uid: '68', name: 'Івано-Франківський район', short: 'Ів-Франк. р-н', type: 'raion', oblastUid: '13' },
    { uid: '69', name: 'Косівський район', short: 'Косів р-н', type: 'raion', oblastUid: '13' },
    { uid: '70', name: 'Коломийський район', short: 'Коломия р-н', type: 'raion', oblastUid: '13' },
    { uid: '71', name: 'Калуський район', short: 'Калуш р-н', type: 'raion', oblastUid: '13' },
    { uid: '72', name: 'Надвірнянський район', short: 'Надвірна р-н', type: 'raion', oblastUid: '13' },

    // Київська (14)
    { uid: '73', name: 'Білоцерківський район', short: 'Біла Церква р-н', type: 'raion', oblastUid: '14' },
    { uid: '74', name: 'Вишгородський район', short: 'Вишгород р-н', type: 'raion', oblastUid: '14' },
    { uid: '75', name: 'Бучанський район', short: 'Буча р-н', type: 'raion', oblastUid: '14' },
    { uid: '76', name: 'Обухівський район', short: 'Обухів р-н', type: 'raion', oblastUid: '14' },
    { uid: '77', name: 'Фастівський район', short: 'Фастів р-н', type: 'raion', oblastUid: '14' },
    { uid: '78', name: 'Бориспільський район', short: 'Бориспіль р-н', type: 'raion', oblastUid: '14' },
    { uid: '79', name: 'Броварський район', short: 'Бровари р-н', type: 'raion', oblastUid: '14' },

    // Кіровоградська (15)
    { uid: '80', name: 'Олександрійський район', short: 'Олександрія р-н', type: 'raion', oblastUid: '15' },
    { uid: '81', name: 'Кропивницький район', short: 'Кропивницький р-н', type: 'raion', oblastUid: '15' },
    { uid: '82', name: 'Голованівський район', short: 'Голованівськ р-н', type: 'raion', oblastUid: '15' },
    { uid: '83', name: 'Новоукраїнський район', short: 'Новоукраїнка р-н', type: 'raion', oblastUid: '15' },

    // Миколаївська (17)
    { uid: '95', name: 'Вознесенський район', short: 'Вознесенськ р-н', type: 'raion', oblastUid: '17' },
    { uid: '96', name: 'Баштанський район', short: 'Баштанка р-н', type: 'raion', oblastUid: '17' },
    { uid: '97', name: 'Первомайський район', short: 'Первомайськ р-н', type: 'raion', oblastUid: '17' },
    { uid: '98', name: 'Миколаївський район', short: 'Миколаїв р-н', type: 'raion', oblastUid: '17' },

    // Одеська (18)
    { uid: '99', name: 'Подільський район', short: 'Подільськ р-н', type: 'raion', oblastUid: '18' },
    { uid: '100', name: 'Березівський район', short: 'Березівка р-н', type: 'raion', oblastUid: '18' },
    { uid: '101', name: 'Ізмаїльський район', short: 'Ізмаїл р-н', type: 'raion', oblastUid: '18' },
    { uid: '102', name: 'Білгород-Дністровський район', short: 'Білгород-Дн. р-н', type: 'raion', oblastUid: '18' },
    { uid: '103', name: 'Роздільнянський район', short: 'Роздільна р-н', type: 'raion', oblastUid: '18' },
    { uid: '104', name: 'Одеський район', short: 'Одеса р-н', type: 'raion', oblastUid: '18' },
    { uid: '105', name: 'Болградський район', short: 'Болград р-н', type: 'raion', oblastUid: '18' },

    // Полтавська (19)
    { uid: '106', name: 'Лубенський район', short: 'Лубни р-н', type: 'raion', oblastUid: '19' },
    { uid: '107', name: 'Кременчуцький район', short: 'Кременчук р-н', type: 'raion', oblastUid: '19' },
    { uid: '108', name: 'Миргородський район', short: 'Миргород р-н', type: 'raion', oblastUid: '19' },
    { uid: '109', name: 'Полтавський район', short: 'Полтава р-н', type: 'raion', oblastUid: '19' },

    // Сумська (20)
    { uid: '114', name: 'Сумський район', short: 'Суми р-н', type: 'raion', oblastUid: '20' },
    { uid: '115', name: 'Шосткинський район', short: 'Шостка р-н', type: 'raion', oblastUid: '20' },
    { uid: '116', name: 'Роменський район', short: 'Ромни р-н', type: 'raion', oblastUid: '20' },
    { uid: '117', name: 'Конотопський район', short: 'Конотоп р-н', type: 'raion', oblastUid: '20' },
    { uid: '118', name: 'Охтирський район', short: 'Охтирка р-н', type: 'raion', oblastUid: '20' },

    // Тернопільська (21)
    { uid: '119', name: 'Тернопільський район', short: 'Тернопіль р-н', type: 'raion', oblastUid: '21' },
    { uid: '120', name: 'Кременецький район', short: 'Кременець р-н', type: 'raion', oblastUid: '21' },
    { uid: '121', name: 'Чортківський район', short: 'Чортків р-н', type: 'raion', oblastUid: '21' },

    // Харківська (22)
    { uid: '122', name: 'Чугуївський район', short: 'Чугуїв р-н', type: 'raion', oblastUid: '22' },
    { uid: '123', name: "Куп'янський район", short: "Куп'янськ р-н", type: 'raion', oblastUid: '22' },
    { uid: '124', name: 'Харківський район', short: 'Харків р-н', type: 'raion', oblastUid: '22' },
    { uid: '125', name: 'Ізюмський район', short: 'Ізюм р-н', type: 'raion', oblastUid: '22' },
    { uid: '126', name: 'Богодухівський район', short: 'Богодухів р-н', type: 'raion', oblastUid: '22' },
    { uid: '127', name: 'Красноградський район', short: 'Красноград р-н', type: 'raion', oblastUid: '22' },
    { uid: '128', name: 'Лозівський район', short: 'Лозова р-н', type: 'raion', oblastUid: '22' },

    // Херсонська (23)
    { uid: '129', name: 'Бериславський район', short: 'Берислав р-н', type: 'raion', oblastUid: '23' },
    { uid: '130', name: 'Скадовський район', short: 'Скадовськ р-н', type: 'raion', oblastUid: '23' },
    { uid: '131', name: 'Каховський район', short: 'Каховка р-н', type: 'raion', oblastUid: '23' },
    { uid: '132', name: 'Херсонський район', short: 'Херсон р-н', type: 'raion', oblastUid: '23' },
    { uid: '133', name: 'Генічеський район', short: 'Генічеськ р-н', type: 'raion', oblastUid: '23' },

    // Черкаська (24)
    { uid: '150', name: 'Звенигородський район', short: 'Звенигородка р-н', type: 'raion', oblastUid: '24' },
    { uid: '151', name: 'Уманський район', short: 'Умань р-н', type: 'raion', oblastUid: '24' },
    { uid: '152', name: 'Черкаський район', short: 'Черкаси р-н', type: 'raion', oblastUid: '24' },
    { uid: '153', name: 'Золотоніський район', short: 'Золотоноша р-н', type: 'raion', oblastUid: '24' },

    // Чернігівська (25)
    { uid: '140', name: 'Чернігівський район', short: 'Чернігів р-н', type: 'raion', oblastUid: '25' },
    { uid: '141', name: 'Новгород-Сіверський район', short: 'Н-Сіверський р-н', type: 'raion', oblastUid: '25' },
    { uid: '142', name: 'Ніжинський район', short: 'Ніжин р-н', type: 'raion', oblastUid: '25' },
    { uid: '143', name: 'Прилуцький район', short: 'Прилуки р-н', type: 'raion', oblastUid: '25' },
    { uid: '144', name: 'Корюківський район', short: 'Корюківка р-н', type: 'raion', oblastUid: '25' },

    // Чернівецька (26)
    { uid: '137', name: 'Чернівецький район', short: 'Чернівці р-н', type: 'raion', oblastUid: '26' },
    { uid: '138', name: 'Вижницький район', short: 'Вижниця р-н', type: 'raion', oblastUid: '26' },
    { uid: '139', name: 'Дністровський район', short: 'Дністровськ р-н', type: 'raion', oblastUid: '26' },

    // Львівська (27)
    { uid: '88', name: 'Самбірський район', short: 'Самбір р-н', type: 'raion', oblastUid: '27' },
    { uid: '89', name: 'Стрийський район', short: 'Стрий р-н', type: 'raion', oblastUid: '27' },
    { uid: '90', name: 'Львівський район', short: 'Львів р-н', type: 'raion', oblastUid: '27' },
    { uid: '91', name: 'Дрогобицький район', short: 'Дрогобич р-н', type: 'raion', oblastUid: '27' },
    { uid: '92', name: 'Червоноградський район', short: 'Червоноград р-н', type: 'raion', oblastUid: '27' },
    { uid: '93', name: 'Яворівський район', short: 'Яворів р-н', type: 'raion', oblastUid: '27' },
    { uid: '94', name: 'Золочівський район', short: 'Золочів р-н', type: 'raion', oblastUid: '27' },

    // Донецька (28)
    { uid: '49', name: 'Кальміуський район', short: 'Кальміус р-н', type: 'raion', oblastUid: '28' },
    { uid: '50', name: 'Краматорський район', short: 'Краматорськ р-н', type: 'raion', oblastUid: '28' },
    { uid: '51', name: 'Горлівський район', short: 'Горлівка р-н', type: 'raion', oblastUid: '28' },
    { uid: '52', name: 'Маріупольський район', short: 'Маріуполь р-н', type: 'raion', oblastUid: '28' },
    { uid: '53', name: 'Донецький район', short: 'Донецьк р-н', type: 'raion', oblastUid: '28' },
    { uid: '54', name: 'Бахмутський район', short: 'Бахмут р-н', type: 'raion', oblastUid: '28' },
    { uid: '55', name: 'Волноваський район', short: 'Волноваха р-н', type: 'raion', oblastUid: '28' },
    { uid: '56', name: 'Покровський район', short: 'Покровськ р-н', type: 'raion', oblastUid: '28' },
];
