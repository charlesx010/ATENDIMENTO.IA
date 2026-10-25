// Catálogo de prévia: cada lote é extraído dos materiais validados pelo usuário.
// Não contém dados de pacientes e não é publicado em produção.
export const PRESCRIPTION_CATALOG = [
  {
    id: 'faringoamigdalite',
    name: 'Faringoamigdalite',
    setting: 'Atenção básica',
    audience: 'Adulto',
    status: 'Lote 1 revisável',
    source: 'Guia de Prescrições - Plantão e UBS · material enviado pelo usuário (p. 166-170)',
    gate: 'Confirmar o contexto clínico antes de escolher a opção. Quadros inespecíficos e estreptocócicos exigem condutas diferentes.',
    options: [
      {
        id: 'inespecifica',
        title: 'Opção A - faringoamigdalite inespecífica',
        note: 'Modelo sintomático do material de origem.',
        prescription: 'USO ORAL\n\n1) Dipirona 500 mg - 01 caixa\nTomar 02 comprimidos se febre ou dor, podendo repetir de 6/6 horas.\n\n2) Bala de gengibre - 01 pacote\nDissolver lentamente uma pastilha na boca, podendo repetir de 2/2 horas conforme necessidade.\n\n3) Bicarbonato de sódio - 01 caixa\nDissolver três colheres de chá em um copo com água e gargarejar 3 vezes ao dia.'
      },
      {
        id: 'amoxicilina',
        title: 'Opção B - estreptocócica: amoxicilina',
        note: 'Modelo oral do material de origem.',
        prescription: 'USO ORAL\n\n1) Amoxicilina 500 mg - 20 comprimidos\nTomar 01 comprimido de 12/12 horas por 10 dias.\nHorários sugeridos: 08:00 / 20:00.\n\n2) Bala de gengibre - 01 pacote\nDissolver lentamente uma pastilha na boca, podendo repetir de 2/2 horas conforme necessidade.\n\n3) Bicarbonato de sódio - 01 caixa\nDissolver três colheres de chá em um copo com água e gargarejar 3 vezes ao dia.'
      },
      {
        id: 'azitromicina',
        title: 'Opção C - estreptocócica: azitromicina',
        note: 'Modelo alternativo do material de origem.',
        prescription: 'USO ORAL\n\n1) Azitromicina 500 mg - 05 comprimidos\nTomar 01 comprimido ao dia, no mesmo horário, por 05 dias.\nHorário sugerido: 08:00.\n\n2) Bala de gengibre - 01 pacote\nDissolver lentamente uma pastilha na boca, podendo repetir de 2/2 horas conforme necessidade.\n\n3) Bicarbonato de sódio - 01 caixa\nDissolver três colheres de chá em um copo com água e gargarejar 3 vezes ao dia.'
      }
    ]
  },
  ['aftas-orais', 'Aftas orais', 'Atenção básica', 'Adulto'],
  ['asma-exacerbacao', 'Asma - exacerbação', 'Urgência', 'Adulto'],
  ['candidiase', 'Candidíase', 'Atenção básica', 'Adulto'],
  ['conjuntivite', 'Conjuntivite', 'Atenção básica', 'Adulto'],
  ['dengue', 'Dengue', 'Urgência', 'Adulto'],
  ['diarreia-aguda', 'Diarreia aguda', 'Atenção básica', 'Adulto'],
  ['infeccao-urinaria', 'Infecção do trato urinário', 'Atenção básica', 'Adulto'],
  ['lombalgia', 'Lombalgia mecânica', 'Atenção básica', 'Adulto'],
  ['otite-media', 'Otite média aguda', 'Atenção básica', 'Adulto'],
  ['rinossinusite', 'Rinossinusite aguda', 'Atenção básica', 'Adulto'],
  ['urticaria', 'Urticária aguda', 'Atenção básica', 'Adulto']
].map((item) => Array.isArray(item)
  ? {id: item[0], name: item[1], setting: item[2], audience: item[3], status: 'Em organização'}
  : item);
