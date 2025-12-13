export type UserType = 'AGENCY' | 'INDEPENDENT_OWNER' | 'PLATFORM';
export type PropertyType = 'RESIDENTIAL' | 'COMMERCIAL' | 'RURAL' | 'RURAL_RESIDENCE';
export type PersonType = 'PF' | 'PJ'; // Pessoa Física ou Jurídica

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  type: 'CTR' | 'ACD' | 'VST'; // Contract, Accord, Inspection
  allowedUserTypes: UserType[]; // Who can use this template
  propertyType?: PropertyType;
  landlordType?: PersonType;
  tenantType?: PersonType;
  category: 'ADMINISTRATION' | 'RENTAL' | 'PLATFORM_SERVICE' | 'PARTNERSHIP';
}

// ========================================
// CONTRATO 1: ADMINISTRAÇÃO DE IMÓVEL
// IMOBILIÁRIA / LOCADOR (PF) / LOCATÁRIO
// ========================================

const adminImobiliariaPfLocatario: ContractTemplate = {
  id: "admin-imobiliaria-pf-locatario",
  name: "Administração de Imóvel - Imobiliária / Locador PF / Locatário",
  description: "Contrato de administração de imóvel entre Imobiliária, Locador Pessoa Física e Locatário",
  type: "CTR",
  allowedUserTypes: ['AGENCY'],
  propertyType: 'RESIDENTIAL',
  landlordType: 'PF',
  tenantType: 'PF',
  category: 'ADMINISTRATION',
  content: `CONTRATO DE ADMINISTRAÇÃO DE IMÓVEL — IMOBILIÁRIA / LOCADOR (PESSOA FÍSICA) / LOCATÁRIO

Pelo presente instrumento particular, as partes identificadas abaixo celebram o presente CONTRATO DE ADMINISTRAÇÃO DE IMÓVEL E LOCAÇÃO RESIDENCIAL, que será regido pela legislação aplicável e pelas cláusulas seguintes:

---

I – QUALIFICAÇÃO DAS PARTES

1. IMOBILIÁRIA / ADMINISTRADORA
Razão Social: [IMOBILIARIA_RAZAO_SOCIAL]
Nome Fantasia: [IMOBILIARIA_NOME_FANTASIA]
CNPJ: [IMOBILIARIA_CNPJ]
CRECI: [IMOBILIARIA_CRECI]
Endereço Completo: [IMOBILIARIA_ENDERECO]
Representante Legal: [IMOBILIARIA_REPRESENTANTE]
Documento do Representante: [IMOBILIARIA_REP_DOC]
E-mail: [IMOBILIARIA_EMAIL]
Telefone: [IMOBILIARIA_TELEFONE]

2. PROPRIETÁRIO / LOCADOR – PESSOA FÍSICA
Nome Completo: [LOCADOR_NOME]
Nacionalidade: [LOCADOR_NACIONALIDADE]
Estado Civil: [LOCADOR_ESTADO_CIVIL]
Profissão: [LOCADOR_PROFISSAO]
CPF: [LOCADOR_CPF]
RG: [LOCADOR_RG]
Data de Nascimento: [LOCADOR_DATA_NASC]
Endereço Completo: [LOCADOR_ENDERECO]
E-mail: [LOCADOR_EMAIL]
Telefone: [LOCADOR_TELEFONE]

3. LOCATÁRIO – PESSOA FÍSICA
Nome Completo: [LOCATARIO_NOME]
Nacionalidade: [LOCATARIO_NACIONALIDADE]
Estado Civil: [LOCATARIO_ESTADO_CIVIL]
Profissão: [LOCATARIO_PROFISSAO]
CPF: [LOCATARIO_CPF]
RG: [LOCATARIO_RG]
Data de Nascimento: [LOCATARIO_DATA_NASC]
Endereço Atual: [LOCATARIO_ENDERECO_ATUAL]
E-mail: [LOCATARIO_EMAIL]
Telefone: [LOCATARIO_TELEFONE]

4. IMÓVEL OBJETO
Endereço Completo: [IMOVEL_ENDERECO]
Tipo: [IMOVEL_TIPO]
Matrícula / Registro Imobiliário: [IMOVEL_MATRICULA]
Descrição Complementar: [IMOVEL_DESCRICAO]
Mobílias / Itens inclusos: [IMOVEL_MOVEIS_LISTA]
Padrão de Energia: [IMOVEL_ENERGIA]

---

II – FINALIDADE DO CONTRATO

Este instrumento tem por finalidade:
a) autorizar a IMOBILIÁRIA a administrar o imóvel do LOCADOR;
b) reger a locação residencial entre LOCADOR e LOCATÁRIO;
c) definir responsabilidades, valores, obrigações e procedimentos de vistoria digital.

---

III – VALORES, PAGAMENTOS E REPASSES

1. Valor do Aluguel
O aluguel mensal será de R$ [VALOR_ALUGUEL], com vencimento todo dia [DIA_VENCIMENTO].

2. Reajuste
O aluguel será reajustado anualmente pelo índice [INDICE_REAJUSTE], conforme legislação vigente.

3. Encargos do Locatário
O LOCATÁRIO pagará integralmente:
• consumo de água – [AGUA_RESPONSAVEL]
• consumo de gás – [GAS_RESPONSAVEL]
• energia elétrica – [ENERGIA_RESPONSAVEL]
• condomínio – [CONDOMINIO_RESPONSAVEL]
• IPTU – [IPTU_RESPONSAVEL]
• Seguro incêndio – [SEGURO_INCENDIO_VALOR]

Valores poderão ser atualizados automaticamente no sistema.

4. Taxa de Administração da Imobiliária
A IMOBILIÁRIA receberá [TAXA_ADMINISTRACAO]% sobre o valor mensal do aluguel.

5. Repasse ao Proprietário
Repasses ao LOCADOR ocorrerão até [DIA_REPASSE], descontados:
• taxa de administração
• impostos retidos
• valores de manutenção aprovados
• tarifas e multas pagas pelo sistema

---

IV – GARANTIAS LOCATÍCIAS

Tipo de garantia adotada: [TIPO_GARANTIA]
• Valor da garantia: R$ [VALOR_GARANTIA]
• Dados do fiador, se aplicável: [FIADOR_DADOS]
• Regras de devolução após vistoria final.

---

V – VISTORIAS (DIGITAL E PRESENCIAL)

1. Vistoria Inicial
Será realizada por meio de laudo digital com fotos, vídeos e assinatura eletrônica:
Data: [DATA_VISTORIA_INICIAL]
Responsável: [RESP_VISTORIA_INICIAL]
O LOCATÁRIO terá 72 horas para contestar o laudo no aplicativo.

2. Vistoria Final
O imóvel deverá ser entregue no mesmo estado em que foi recebido, salvo deterioração natural pelo uso.

3. Avarias
Qualquer dano encontrado será debitado do LOCATÁRIO, podendo o sistema emitir cobrança automática.

---

VI – OBRIGAÇÕES DO LOCADOR

1. Garantir a posse pacífica do imóvel.
2. Entregar o imóvel em condições adequadas de uso.
3. Arcar com reparos estruturais.
4. Informar imediatamente mudanças cadastrais.
5. Pagar impostos e taxas atribuídas ao proprietário, quando não repassadas ao inquilino.

---

VII – OBRIGAÇÕES DO LOCATÁRIO

1. Usar o imóvel somente para fins residenciais.
2. Zelar pela integridade do imóvel e mobiliário.
3. Pagar aluguel e encargos em dia.
4. Permitir vistorias agendadas.
5. Não sublocar sem autorização.
6. Comunicar defeitos estruturais imediatamente.
7. Devolver o imóvel no estado em que recebeu.

---

VIII – OBRIGAÇÕES DA IMOBILIÁRIA

1. Administrar valores, cobranças e repasses.
2. Notificar atrasos e emitir boletos.
3. Realizar vistorias com assinatura digital.
4. Guardar documentos e registros.
5. Informar o LOCADOR sobre manutenções necessárias.
6. Representar o proprietário perante o LOCATÁRIO dentro dos limites deste contrato.

---

IX – MULTAS, ATRASOS E PENALIDADES

• Multa de [MULTA_ATRASO]% sobre o aluguel em atraso.
• Juros de [JUROS_ATRASO]% ao mês.
• Correção monetária conforme índice do aluguel.
• Rescisão antecipada: multa de [VALOR_MULTA_RESCISAO].

---

X – PRAZO DO CONTRATO

Este contrato terá duração de [PRAZO_MESES] meses, iniciando em [DATA_INICIO] e terminando em [DATA_FIM].

Renovações automáticas podem ocorrer conforme regras do sistema e autorização do proprietário.

---

XI – RESCISÃO

Qualquer parte poderá rescindir com aviso prévio de [DIAS_AVISO_PREVIO] dias, exceto por infrações contratuais, que permitem encerramento imediato.

---

XII – LGPD E USO DE DADOS

As partes autorizam o uso dos dados pelo sistema exclusivamente para:
• registros de vistoria
• geração de documentos
• notificações
• pagamentos
• auditoria e segurança

Dados serão armazenados conforme LGPD.

---

XIII – DOCUMENTOS ANEXOS

• Termo de Vistoria Inicial [ANEXO_VISTORIA_INICIAL]
• Termo de Vistoria Final [ANEXO_VISTORIA_FINAL]
• Comprovantes de Garantia [ANEXO_GARANTIA]
• Documentos pessoais digitalizados [ANEXOS_DOCUMENTOS]

---

XIV – FORO

Fica eleito o foro da comarca de [FORO_CIDADE_ESTADO] para dirimir conflitos deste contrato.`
};

// ========================================
// EXPORTAÇÃO DOS CONTRATOS
// ========================================

export const contractTemplates: ContractTemplate[] = [
  adminImobiliariaPfLocatario,
];

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

export const getTemplateById = (id: string): ContractTemplate | undefined => {
  return contractTemplates.find(template => template.id === id);
};

export const getTemplatesByType = (type: 'CTR' | 'ACD' | 'VST'): ContractTemplate[] => {
  return contractTemplates.filter(template => template.type === type);
};

export const getTemplatesByUserType = (userType: UserType): ContractTemplate[] => {
  return contractTemplates.filter(template =>
    template.allowedUserTypes.includes(userType)
  );
};

export const getTemplatesByPropertyType = (propertyType: PropertyType): ContractTemplate[] => {
  return contractTemplates.filter(template =>
    template.propertyType === propertyType
  );
};

export const getTemplatesByCategory = (category: ContractTemplate['category']): ContractTemplate[] => {
  return contractTemplates.filter(template =>
    template.category === category
  );
};

export const getTemplatesForUser = (
  userType: UserType,
  propertyType?: PropertyType,
  category?: ContractTemplate['category']
): ContractTemplate[] => {
  return contractTemplates.filter(template => {
    const matchesUserType = template.allowedUserTypes.includes(userType);
    const matchesPropertyType = !propertyType || template.propertyType === propertyType;
    const matchesCategory = !category || template.category === category;
    return matchesUserType && matchesPropertyType && matchesCategory;
  });
};
