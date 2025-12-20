export type UserType = 'AGENCY' | 'INDEPENDENT_OWNER' | 'PLATFORM';
export type PropertyType = 'RESIDENTIAL' | 'COMMERCIAL' | 'RURAL' | 'RURAL_RESIDENCE';
export type PersonType = 'PF' | 'PJ'; 

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  type: 'CTR' | 'ACD' | 'VST'; 
  allowedUserTypes: UserType[];
  propertyType?: PropertyType;
  landlordType?: PersonType;
  tenantType?: PersonType;
  category: 'ADMINISTRATION' | 'RENTAL' | 'PLATFORM_SERVICE' | 'PARTNERSHIP';
}

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

const administracaoImovel: ContractTemplate = {
  id: "administracao-imovel",
  name: "Contrato de Administração de Imóvel",
  description: "Contrato de administração entre Imobiliária e Proprietário (sem locatário)",
  type: "CTR",
  allowedUserTypes: ['AGENCY'],
  propertyType: 'RESIDENTIAL',
  landlordType: 'PF',
  category: 'ADMINISTRATION',
  content: `CONTRATO 2 – CONTRATO DE ADMINISTRAÇÃO DE IMÓVEL

────────────────────────────────────────────────────

**IDENTIFICAÇÃO DAS PARTES**

**IMOBILIÁRIA / ADMINISTRADORA**
Razão Social: [IMOBILIARIA_RAZAO_SOCIAL]
Nome Fantasia: [IMOBILIARIA_NOME_FANTASIA]
CNPJ: [IMOBILIARIA_CNPJ]
CRECI: [IMOBILIARIA_CRECI]
Endereço Completo: [IMOBILIARIA_ENDERECO]
Representante Legal: [IMOBILIARIA_REPRESENTANTE]
Documento: [IMOBILIARIA_REP_DOC]
Telefone: [IMOBILIARIA_TELEFONE]
E-mail: [IMOBILIARIA_EMAIL]

────────────────────────────────────────────────────

**LOCADOR / PROPRIETÁRIO — PESSOA FÍSICA**
Nome Completo: [LOCADOR_NOME]
Nacionalidade: [LOCADOR_NACIONALIDADE]
Estado Civil: [LOCADOR_ESTADO_CIVIL]
Profissão: [LOCADOR_PROFISSAO]
CPF: [LOCADOR_CPF]
RG: [LOCADOR_RG]
Data de Nascimento: [LOCADOR_DATA_NASC]
Endereço Completo: [LOCADOR_ENDERECO]
Telefone: [LOCADOR_TELEFONE]
E-mail: [LOCADOR_EMAIL]

────────────────────────────────────────────────────

**IMÓVEL OBJETO DA ADMINISTRAÇÃO**

Endereço Completo: [IMOVEL_ENDERECO]
Tipo: [IMOVEL_TIPO]
Matrícula / Registro: [IMOVEL_MATRICULA]
Área Construída: [IMOVEL_AREA_CONSTRUIDA]
Área Total: [IMOVEL_AREA_TOTAL]
Descrição: [IMOVEL_DESCRICAO]
Mobílias / Itens: [IMOVEL_MOVEIS]
Condomínio: [IMOVEL_CONDOMINIO]
Valor Condomínio: [IMOVEL_CONDOMINIO_VALOR]
IPTU (anual/mensal): [IMOVEL_IPTU_VALOR]

────────────────────────────────────────────────────

**OBJETO DO CONTRATO**

Este contrato tem como objeto:
a) autorizar a IMOBILIÁRIA a administrar o imóvel acima identificado;
b) permitir que a IMOBILIÁRIA realize locação, cobrança, repasse, intermediação e procedimentos administrativos;
c) executar serviços de rotina de administração imobiliária.

────────────────────────────────────────────────────

**PODERES OUTORGADOS À IMOBILIÁRIA**

O LOCADOR autoriza a IMOBILIÁRIA a:
• divulgar o imóvel em plataformas digitais e impressas;
• realizar visitas e agendamentos;
• assinar contrato de locação em nome do LOCADOR, quando autorizado: [AUTORIZA_ASSINATURA_LOCACAO];
• cobrar aluguel, encargos e repasses;
• emitir boletos, notificações e relatórios;
• contratar serviços de manutenção até R$ [VALOR_LIMITE_MANUTENCAO] sem necessidade de prévia autorização;
• intermediar relações com síndico e condomínio;
• realizar vistorias digitalmente.

────────────────────────────────────────────────────

**REMUNERAÇÃO DA IMOBILIÁRIA**

A IMOBILIÁRIA receberá:

Taxa de Administração
Percentual: [TAXA_ADMINISTRACAO]% sobre o valor do aluguel recebido.

Taxa de Intermediação / Locação
Valor fixo: R$ [VALOR_TAXA_INTERMEDIACAO]
ou
Percentual: [TAXA_INTERMEDIACAO_PORCENTAGEM]%

Outras Taxas (se houver)
• emissão de 2ª via de boleto: R$ [VALOR_2VIA]
• relatório especial / laudos adicionais: R$ [VALOR_LAUDO_EXTRA]

Todas as taxas poderão ser atualizadas pelo índice [INDICE_REAJUSTE].

────────────────────────────────────────────────────

**REPASSE E CONTABILIDADE**

Os repasses ao LOCADOR ocorrerão até o dia [DIA_REPASSE], já descontados:
• taxa de administração
• manutenções autorizadas
• impostos
• tarifas bancárias
• valores pagos ao condomínio, se autorizados
• multas ou encargos pagos via sistema

Relatórios serão disponibilizados digitalmente.

────────────────────────────────────────────────────

**VISTORIAS (DIGITAL E PRESENCIAL)**

Vistoria Inicial
Realizada antes da locação.
Data: [DATA_VISTORIA_INICIAL]
Responsável: [RESP_VISTORIA_INICIAL]
Anexos digitais: [ANEXO_VISTORIA_INICIAL]

Vistoria Final
Realizada após a devolução do imóvel.
Comparação automática com fotos, vídeos e laudo inicial.

────────────────────────────────────────────────────

**OBRIGAÇÕES DO LOCADOR**

O LOCADOR se compromete a:
• entregar o imóvel em condições de uso;
• manter impostos e encargos de responsabilidade do proprietário;
• realizar reparos estruturais;
• informar alterações cadastrais;
• permitir acesso para manutenção e vistoria;
• entregar documentação necessária para locação.

────────────────────────────────────────────────────

**OBRIGAÇÕES DA IMOBILIÁRIA**

A IMOBILIÁRIA deverá:
• administrar o imóvel conforme boas práticas;
• realizar cobranças e intermediações;
• acompanhar pagamentos;
• emitir relatórios periódicos;
• conduzir vistorias;
• atuar com transparência e diligência;
• comunicar ao LOCADOR irregularidades na locação.

────────────────────────────────────────────────────

**RESPONSABILIDADES**

A IMOBILIÁRIA não se responsabiliza por:
• inadimplência do locatário (salvo se contratado plano específico [PLANO_GARANTIA_ALUGUEL]);
• danos causados pelo locatário;
• vícios ocultos no imóvel;
• valores não quitados diretamente pelo LOCADOR.

O LOCADOR autoriza a IMOBILIÁRIA a agir em situações emergenciais com gasto de até R$ [VALOR_EMERGENCIA].

────────────────────────────────────────────────────

**PRAZO**

O presente contrato tem validade de [PRAZO_MESES] meses a partir de [DATA_INICIO], renovando-se automaticamente, salvo manifestação das partes.

────────────────────────────────────────────────────

**RESCISÃO**

Pode haver rescisão:
• por decisão unilateral, com aviso prévio de [DIAS_AVISO_PREVIO] dias;
• por descumprimento contratual, com rescisão imediata;
• por encerramento da atividade da imobiliária.

Multa por rescisão sem aviso prévio: [VALOR_MULTA_RESCISAO]

────────────────────────────────────────────────────

**MULTAS E PENALIDADES**

• Multa de atraso na taxa de administração: [MULTA_ATRASO]%
• Juros: [JUROS_ATRASO]% ao mês
• Atualização monetária pelo índice [INDICE_REAJUSTE]

────────────────────────────────────────────────────

**TRATAMENTO DE DADOS (LGPD)**

A IMOBILIÁRIA poderá armazenar, tratar e compartilhar dados exclusivamente para:
• administração do imóvel
• emissão de documentos
• notificações e cobranças
• integrações com bancos e gateways
• auditorias e segurança

Com base na Lei 13.709/2018.

────────────────────────────────────────────────────

**FORO**

Fica eleito o foro da comarca de [FORO_CIDADE_ESTADO].

────────────────────────────────────────────────────

**ASSINAM DIGITALMENTE**

IMOBILIÁRIA: [IMOBILIARIA_RAZAO_SOCIAL] – [DATA_ASS_IMOBILIARIA]
LOCADOR: [LOCADOR_NOME] – [DATA_ASS_LOCADOR]`
};

const contratoAdministracaoImovel: ContractTemplate = {
  id: "contrato-administracao-imovel",
  name: "Contrato de Administração de Imóvel",
  description: "Contrato de administração de imóvel entre Imobiliária e Proprietário/Locador",
  type: "CTR",
  allowedUserTypes: ['AGENCY'],
  propertyType: 'RESIDENTIAL',
  landlordType: 'PF',
  category: 'ADMINISTRATION',
  content: `CONTRATO DE ADMINISTRAÇÃO DE IMÓVEL

────────────────────────────────────────────────────

**IDENTIFICAÇÃO DAS PARTES**

────────────────────────────────────────────────────

**IMOBILIÁRIA / ADMINISTRADORA**

Razão Social: [IMOBILIARIA_RAZAO_SOCIAL]
Nome Fantasia: [IMOBILIARIA_NOME_FANTASIA]
CNPJ: [IMOBILIARIA_CNPJ]
CRECI: [IMOBILIARIA_CRECI]
Endereço Completo: [IMOBILIARIA_ENDERECO]
Representante Legal: [IMOBILIARIA_REPRESENTANTE]
Documento: [IMOBILIARIA_REP_DOC]
Telefone: [IMOBILIARIA_TELEFONE]
E-mail: [IMOBILIARIA_EMAIL]

────────────────────────────────────────────────────

**LOCADOR / PROPRIETÁRIO**

Nome Completo: [LOCADOR_NOME]
Nacionalidade: [LOCADOR_NACIONALIDADE]
Estado Civil: [LOCADOR_ESTADO_CIVIL]
Profissão: [LOCADOR_PROFISSAO]
CPF: [LOCADOR_CPF]
RG: [LOCADOR_RG]
Endereço Completo: [LOCADOR_ENDERECO]
Telefone: [LOCADOR_TELEFONE]
E-mail: [LOCADOR_EMAIL]

────────────────────────────────────────────────────

**IMÓVEL OBJETO**

Endereço Completo: [IMOVEL_ENDERECO]
Bairro / Localidade: [IMOVEL_BAIRRO]
Tipo do Imóvel: [IMOVEL_TIPO]
Matrícula / Registro: [IMOVEL_MATRICULA]
Área Total / Construída: [IMOVEL_AREA]
Descrição Complementar: [IMOVEL_DESCRICAO]
Mobílias / Itens: [IMOVEL_MOVEIS]

────────────────────────────────────────────────────

**OBJETO DO CONTRATO**

O LOCADOR confere à IMOBILIÁRIA poderes para:
• administrar o imóvel identificado;
• intermediar contratos de locação;
• promover divulgação para fins de locação;
• cobrar aluguéis e encargos;
• emitir recibos, notificações, boletos e relatórios;
• efetuar repasses financeiros;
• praticar atos necessários para administração rotineira.

────────────────────────────────────────────────────

**PODERES OUTORGADOS À IMOBILIÁRIA**

O LOCADOR autoriza a IMOBILIÁRIA a:
• receber aluguéis, encargos e quaisquer valores;
• promover cobrança amigável;
• aplicar penalidades previstas na Lei 8.245/91;
• contestar inadimplências;
• efetuar e contratar reparos essenciais até [VALOR_LIMITE_MANUTENCAO] sem prévia consulta;
• acompanhar ações condominiais;
• contratar prestadores de serviço quando necessário;
• representar o LOCADOR perante órgãos públicos quando ligado à administração.

────────────────────────────────────────────────────

**TAXA DE ADMINISTRAÇÃO**

O LOCADOR pagará à IMOBILIÁRIA:

Percentual mensal: [TAXA_ADMINISTRACAO]%
Incidência: sobre o valor do aluguel efetivamente recebido.
Possibilidade de atualização monetária: [INDICE_REAJUSTE]

────────────────────────────────────────────────────

**TAXA DE INTERMEDIAÇÃO (LOCAÇÃO)**

A IMOBILIÁRIA fará jus a:
• Valor fixo: [VALOR_TAXA_INTERMEDIACAO], ou
• Percentual: [PERCENTUAL_INTERMEDIACAO]% do primeiro aluguel.

Pago pelo LOCADOR após fechamento da locação.

────────────────────────────────────────────────────

**REPASSES AO LOCADOR**

Os repasses ocorrerão até o dia [DIA_REPASSE], descontados:
• taxa de administração
• taxa de intermediação (quando aplicável)
• manutenções autorizadas
• valores pagos ao condomínio (se autorizado)
• tarifas bancárias
• impostos e tributos retidos

A IMOBILIÁRIA emitirá demonstrativo digital de repasse.

────────────────────────────────────────────────────

**ENCARGOS QUE NÃO SÃO RESPONSABILIDADE DA IMOBILIÁRIA**

A IMOBILIÁRIA não se responsabiliza por:
• inadimplência do locatário (salvo plano contratado: [PLANO_GARANTIA]);
• danos ao imóvel causados por terceiros, vandalismo ou uso indevido;
• vícios ocultos estruturais;
• débitos anteriores à administração;
• pagamento de contas inadimplidas pelo locatário.

────────────────────────────────────────────────────

**OBRIGAÇÕES DO LOCADOR**

O LOCADOR deverá:
• manter IPTU e tributos sob responsabilidade do proprietário;
• providenciar certidões ou documentos necessários;
• permitir entrada para vistorias e reparos;
• autorizar previamente obras não emergenciais;
• garantir condições adequadas de uso para locação;
• comunicar mudanças de dados pessoais e bancários.

────────────────────────────────────────────────────

**OBRIGAÇÕES DA IMOBILIÁRIA**

A IMOBILIÁRIA compromete-se a:
• agir com diligência e transparência;
• administrar o imóvel conforme normas do setor;
• manter registros, recibos, comprovantes e laudos digitais;
• realizar vistoria digital inicial e final;
• comunicar irregularidades ao LOCADOR;
• emitir boletos, recibos, relatórios e notificações;
• promover intermediação profissional entre locador e locatário.

────────────────────────────────────────────────────

**VISTORIAS**

**Vistoria Inicial**
Data: [DATA_VISTORIA_INICIAL]
Responsável: [RESP_VISTORIA_INICIAL]
Laudo: [ANEXO_VISTORIA_INICIAL]

**Vistoria Final**
Comparada com o laudo inicial, considerando desgaste natural.
Laudo: [ANEXO_VISTORIA_FINAL]

────────────────────────────────────────────────────

**RESPONSABILIDADES FINANCEIRAS**

A IMOBILIÁRIA poderá autorizar serviços até [VALOR_LIMITE_SERVICOS].
Valores superiores dependem de autorização do LOCADOR: [MODELO_AUTORIZACAO]

────────────────────────────────────────────────────

**PRAZO DO CONTRATO**

O presente contrato tem validade de [PRAZO_MESES] meses a partir de [DATA_INICIO], renovando-se automaticamente, salvo manifestação das partes com [DIAS_AVISO_PREVIO] dias de antecedência.

────────────────────────────────────────────────────

**RESCISÃO**

A rescisão pode ocorrer:
• por iniciativa de qualquer parte com aviso prévio de [DIAS_AVISO_PREVIO] dias;
• por descumprimento contratual;
• imediatamente em caso de fraude, má-fé ou uso indevido de poderes.

Multa por rescisão sem aviso prévio: [VALOR_MULTA_RESCISAO]

────────────────────────────────────────────────────

**MULTAS E CORREÇÕES**

• Multa: [MULTA_ATRASO]%
• Juros: [JUROS_ATRASO]% ao mês
• Correção: índice [INDICE_REAJUSTE]

────────────────────────────────────────────────────

**TRATAMENTO DE DADOS (LGPD)**

Os dados poderão ser utilizados para:
• administração do imóvel
• emissão de documentos
• segurança e auditorias
• integrações bancárias
• notificações e comunicação

Conforme Lei 13.709/2018.

────────────────────────────────────────────────────

**FORO**

Fica eleito o foro de [FORO_CIDADE_ESTADO].

────────────────────────────────────────────────────

**ASSINAM**

IMOBILIÁRIA: [IMOBILIARIA_RAZAO_SOCIAL] – [DATA_ASS_IMOBILIARIA]
LOCADOR: [LOCADOR_NOME] – [DATA_ASS_LOCADOR]`
};

const contratoLocacaoImovelRural: ContractTemplate = {
  id: "contrato-locacao-imovel-rural",
  name: "Contrato de Locação de Imóvel Rural",
  description: "Contrato de locação de imóvel rural entre Locadores Pessoa Física e Locatário Pessoa Jurídica",
  type: "CTR",
  allowedUserTypes: ['AGENCY', 'INDEPENDENT_OWNER'],
  propertyType: 'RURAL',
  landlordType: 'PF',
  tenantType: 'PJ',
  category: 'RENTAL',
  content: `CONTRATO DE LOCAÇÃO DE IMÓVEL RURAL

────────────────────────────────────────────────────

**IDENTIFICAÇÃO DAS PARTES**

────────────────────────────────────────────────────

**LOCADORES / PROPRIETÁRIOS**

**Locador 1:**
Nome Completo: [LOCADOR1_NOME]
Nacionalidade: [LOCADOR1_NACIONALIDADE]
Estado Civil: [LOCADOR1_ESTADO_CIVIL]
Profissão: [LOCADOR1_PROFISSAO]
RG: [LOCADOR1_RG]
CPF: [LOCADOR1_CPF]
Endereço Completo: [LOCADOR1_ENDERECO]

**Locador 2:**
Nome Completo: [LOCADOR2_NOME]
Nacionalidade: [LOCADOR2_NACIONALIDADE]
Estado Civil: [LOCADOR2_ESTADO_CIVIL]
Profissão: [LOCADOR2_PROFISSAO]
RG: [LOCADOR2_RG]
CPF: [LOCADOR2_CPF]
Endereço Completo: [LOCADOR2_ENDERECO]

────────────────────────────────────────────────────

**LOCATÁRIO – PESSOA JURÍDICA**

Razão Social: [LOCATARIO_RAZAO_SOCIAL]
CNPJ: [LOCATARIO_CNPJ]
Endereço Completo: [LOCATARIO_ENDERECO]
Representante Legal: [LOCATARIO_REP_NOME]
Nacionalidade: [LOCATARIO_REP_NACIONALIDADE]
Estado Civil: [LOCATARIO_REP_ESTADO_CIVIL]
CPF: [LOCATARIO_REP_CPF]
RG: [LOCATARIO_REP_RG]
Endereço: [LOCATARIO_REP_ENDERECO]

────────────────────────────────────────────────────

**IMÓVEL OBJETO DA LOCAÇÃO**

Tipo: Imóvel Rural
Localização: [IMOVEL_LOCALIDADE]
Área Total Locada: [IMOVEL_AREA_LOCADA] m²
Área Total da Propriedade: [IMOVEL_AREA_TOTAL] m²
Matrícula / Registro: [IMOVEL_MATRICULA]
Comarca: [IMOVEL_COMARCA]
Descrição Complementar: [IMOVEL_DESCRICAO]

────────────────────────────────────────────────────

**OBJETO**

O presente contrato tem por objeto a locação do imóvel rural acima descrito, pelo LOCADOR ao LOCATÁRIO, para os fins autorizados neste instrumento.

────────────────────────────────────────────────────

**PRAZO**

Prazo: [PRAZO_MESES] meses
Início: [DATA_INICIO]
Término: [DATA_FIM]

Se, após o término, o LOCATÁRIO permanecer no imóvel por mais de 30 dias sem oposição expressa, o contrato será prorrogado por prazo indeterminado, mantendo-se todas as condições.

O imóvel poderá ser devolvido pelo LOCATÁRIO a qualquer tempo, mediante aviso prévio de [DIAS_AVISO_PREVIO] dias.

Caso descumpra o aviso prévio, pagará multa equivalente a [MULTA_RESTITUICAO_MESES] meses de aluguel.

────────────────────────────────────────────────────

**FINALIDADE DA LOCAÇÃO**

O imóvel será utilizado exclusivamente para:
[FINALIDADE_USO]

É vedado ao LOCATÁRIO qualquer uso diverso sem autorização expressa.

────────────────────────────────────────────────────

**VALOR E FORMA DE PAGAMENTO**

**Aluguel**
Valor mensal: R$ [VALOR_ALUGUEL]

**Vencimento**
Até o dia [DIA_VENCIMENTO] de cada mês.

**Dados para Pagamento:**
Pagamento diretamente aos LOCADORES ou por meio de depósito/PIX:
• Banco: [BANCO]
• Agência: [AGENCIA]
• Conta: [CONTA]
• Chave PIX: [CHAVE_PIX]

────────────────────────────────────────────────────

**MULTA POR ATRASO**

Em caso de atraso:
• Multa: [MULTA_ATRASO]%
• Juros: [JUROS_ATRASO]% ao mês
• Correção monetária: [INDICE_REAJUSTE]

────────────────────────────────────────────────────

**CESSÃO, SUBLOCAÇÃO E EMPRÉSTIMO**

É proibido ao LOCATÁRIO:
• ceder
• emprestar
• sublocar
• transferir este contrato

sem autorização por escrito dos LOCADORES.

────────────────────────────────────────────────────

**RESCISÃO AUTOMÁTICA**

O contrato será rescindido imediatamente, sem indenização, nas seguintes hipóteses:
• desapropriação total ou parcial do imóvel;
• impossibilidade do LOCATÁRIO utilizar o imóvel para a finalidade acordada;
• uso irregular ou diverso da finalidade;
• descumprimento de obrigações essenciais.

────────────────────────────────────────────────────

**ALIENAÇÃO DO IMÓVEL**

Se o imóvel for vendido durante a vigência do contrato:
O adquirente deverá respeitar o contrato até o fim do prazo, mantendo todas as condições pactuadas.

────────────────────────────────────────────────────

**INFRAÇÃO CONTRATUAL**

A parte infratora pagará multa equivalente a:
[MULTA_INFRACAO_MESES] meses de aluguel,
sem prejuízo de cobrança de perdas e danos.

────────────────────────────────────────────────────

**RESPONSABILIDADES DAS PARTES**

**LOCADORES**
Devem:
• garantir a posse pacífica;
• entregar o imóvel em condições de uso;
• assegurar a titularidade da propriedade;
• cumprir obrigações fiscais e legais de sua responsabilidade.

**LOCATÁRIO**
Deve:
• usar o imóvel apenas para o fim previsto;
• conservar o imóvel;
• comunicar danos;
• não causar prejuízos ambientais ou estruturais;
• cumprir normas ambientais, agrícolas ou municipais;
• permitir acesso para vistorias com aviso prévio;
• devolver o imóvel nas mesmas condições em que recebeu.

────────────────────────────────────────────────────

**DEVOLUÇÃO DO IMÓVEL**

Ao término, o LOCATÁRIO deve devolver o imóvel:
• nas mesmas condições iniciais, exceto desgaste natural;
• após vistoria final: [DATA_VISTORIA_FINAL]
• com laudo digital: [ANEXO_VISTORIA_FINAL]

Caso haja danos, o LOCATÁRIO arcará com:
• reparos
• indenizações
• custos relacionados

────────────────────────────────────────────────────

**FORO**

Fica eleito o foro da comarca de [FORO_CIDADE_ESTADO], renunciando qualquer outro.

────────────────────────────────────────────────────

**ASSINAM DIGITALMENTE**

**LOCADOR(ES):**
[LOCADOR1_NOME] – [DATA_ASS_LOCADOR1]
[LOCADOR2_NOME] – [DATA_ASS_LOCADOR2]

**LOCATÁRIO (PJ):**
[LOCATARIO_RAZAO_SOCIAL] – [DATA_ASS_LOCATARIO]`
};

const contratoLocacaoResidencialPadrao: ContractTemplate = {
  id: "contrato-locacao-residencial-padrao",
  name: "Contrato de Locação Residencial",
  description: "Contrato de locação residencial padrão entre Locador Pessoa Física e Locatário Pessoa Física",
  type: "CTR",
  allowedUserTypes: ['AGENCY', 'INDEPENDENT_OWNER'],
  propertyType: 'RESIDENTIAL',
  landlordType: 'PF',
  tenantType: 'PF',
  category: 'RENTAL',
  content: `CONTRATO DE LOCAÇÃO RESIDENCIAL

────────────────────────────────────────────────────

**IDENTIFICAÇÃO DAS PARTES**

────────────────────────────────────────────────────

**LOCADOR**

Nome Completo: [LOCADOR_NOME]
Nacionalidade: [LOCADOR_NACIONALIDADE]
Estado Civil: [LOCADOR_ESTADO_CIVIL]
Profissão: [LOCADOR_PROFISSAO]
CPF: [LOCADOR_CPF]
RG: [LOCADOR_RG]
Endereço Completo: [LOCADOR_ENDERECO]
Telefone: [LOCADOR_TELEFONE]
E-mail: [LOCADOR_EMAIL]

────────────────────────────────────────────────────

**LOCATÁRIO**

Nome Completo: [LOCATARIO_NOME]
Nacionalidade: [LOCATARIO_NACIONALIDADE]
Estado Civil: [LOCATARIO_ESTADO_CIVIL]
Profissão: [LOCATARIO_PROFISSAO]
CPF: [LOCATARIO_CPF]
RG: [LOCATARIO_RG]
Data de Nascimento: [LOCATARIO_DATA_NASC]
Endereço Atual: [LOCATARIO_ENDERECO]
Telefone: [LOCATARIO_TELEFONE]
E-mail: [LOCATARIO_EMAIL]

────────────────────────────────────────────────────

**FIADOR**

Nome Completo: [FIADOR_NOME]
CPF: [FIADOR_CPF]
RG: [FIADOR_RG]
Endereço: [FIADOR_ENDERECO]
Profissão: [FIADOR_PROFISSAO]
Responsabilidade solidária: [FIADOR_RESPONSABILIDADE_SOLIDARIA]

────────────────────────────────────────────────────

**IMÓVEL OBJETO DA LOCAÇÃO**

Endereço Completo: [IMOVEL_ENDERECO]
Descrição: [IMOVEL_DESCRICAO]
Matrícula / Registro: [IMOVEL_MATRICULA]
Área: [IMOVEL_AREA]
Mobílias / Itens incluídos: [IMOVEL_MOVEIS]

────────────────────────────────────────────────────

**FINALIDADE**

O imóvel será utilizado exclusivamente para fins residenciais, sendo proibido:
• uso comercial
• sublocação
• hospedagem remunerada (Airbnb, etc.)
• cessão a terceiros não autorizados

Finalidade especial (se aplicável): [FINALIDADE_ESPECIAL]

────────────────────────────────────────────────────

**PRAZO DA LOCAÇÃO**

Prazo total: [PRAZO_MESES] meses
Início: [DATA_INICIO]
Término: [DATA_FIM]

Após o fim do prazo, caso o LOCATÁRIO permaneça no imóvel sem oposição, a locação será prorrogada por prazo indeterminado.

────────────────────────────────────────────────────

**VALORES E PAGAMENTOS**

**Aluguel Mensal**
Valor: R$ [VALOR_ALUGUEL]
Vencimento: dia [DIA_VENCIMENTO]

**Encargos do Locatário**
• Água: [AGUA_RESPONSAVEL]
• Energia Elétrica: [ENERGIA_RESPONSAVEL]
• Gás: [GAS_RESPONSAVEL]
• Condomínio: [CONDOMINIO_RESPONSAVEL]
• IPTU: [IPTU_RESPONSAVEL]
• Seguro incêndio obrigatório: [SEGURO_INCENDIO_VALOR]

**Local de Pagamento**
O pagamento será realizado:
• Diretamente ao locador: [FORMA_PAGAMENTO]
• Ou por meio da administradora: [USO_IMOBILIARIA]
• Dados bancários / PIX: [DADOS_BANCARIOS]

────────────────────────────────────────────────────

**REAJUSTE DO ALUGUEL**

Periodicidade: anual
Índice: [INDICE_REAJUSTE]

────────────────────────────────────────────────────

**GARANTIA LOCATÍCIA**

Modalidade: [TIPO_GARANTIA]
Valor da garantia: R$ [VALOR_GARANTIA]
Dados complementares da garantia: [GARANTIA_DADOS]

────────────────────────────────────────────────────

**VISTORIAS**

**Vistoria Inicial**
Data: [DATA_VISTORIA_INICIAL]
Laudo: [ANEXO_VISTORIA_INICIAL]

**Vistoria Final**
Data: [DATA_VISTORIA_FINAL]
Laudo: [ANEXO_VISTORIA_FINAL]

O locatário devolverá o imóvel nas mesmas condições em que recebeu, salvo desgaste natural.

────────────────────────────────────────────────────

**OBRIGAÇÕES DO LOCADOR**

O LOCADOR deve:
• garantir a posse pacífica do imóvel;
• entregar o imóvel em condições de uso;
• manter tributos de responsabilidade do proprietário;
• realizar reparos estruturais;
• informar mudanças cadastrais.

────────────────────────────────────────────────────

**OBRIGAÇÕES DO LOCATÁRIO**

O LOCATÁRIO se compromete a:
• usar o imóvel apenas para moradia;
• conservar o imóvel;
• comunicar danos e defeitos;
• permitir vistorias mediante aviso;
• pagar aluguel e encargos pontualmente;
• não fazer reformas sem autorização;
• manter limpo e em bom estado;
• devolver o imóvel conforme vistoria inicial.

────────────────────────────────────────────────────

**DANOS E AVARIAS**

O LOCATÁRIO deverá pagar:
• reparos
• reposição de itens
• danos ao imóvel
• prejuízos causados por mau uso

Itens danificados serão cobrados conforme laudo final.

────────────────────────────────────────────────────

**MULTAS, ATRASOS E PENALIDADES**

• Multa por atraso: [MULTA_ATRASO]%
• Juros: [JUROS_ATRASO]% ao mês
• Correção: [INDICE_CORRECAO]
• Multa rescisória por saída antecipada: [MULTA_RESCISAO_MESES] meses de aluguel

────────────────────────────────────────────────────

**RESCISÃO**

A rescisão poderá ocorrer:
• por descumprimento contratual
• por inadimplência
• por mau uso do imóvel
• por interesse das partes, mediante aviso prévio de [DIAS_AVISO_PREVIO] dias

O imóvel será devolvido após vistoria final.

────────────────────────────────────────────────────

**PROIBIÇÕES**

O LOCATÁRIO não poderá:
• sublocar
• ceder o imóvel
• alterar a estrutura
• realizar atividades comerciais
• criar animais proibidos por lei ou condomínio
• instalar gás ou equipamentos sem autorização

────────────────────────────────────────────────────

**LGPD**

Os dados fornecidos serão utilizados exclusivamente para:
• gestão do contrato
• cobranças
• emissão de documentos
• segurança e registros
• relatórios internos

Conforme Lei 13.709/2018.

────────────────────────────────────────────────────

**FORO**

Fica eleito o foro da comarca de [FORO_CIDADE_ESTADO], renunciando qualquer outro.

────────────────────────────────────────────────────

**ASSINAM**

LOCADOR: [LOCADOR_NOME] – [DATA_ASS_LOCADOR]
LOCATÁRIO: [LOCATARIO_NOME] – [DATA_ASS_LOCATARIO]
FIADOR: [FIADOR_NOME] – [DATA_ASS_FIADOR]`
};

const contratoAdministracaoLocacaoComercialPJ: ContractTemplate = {
  id: "contrato-administracao-locacao-comercial-pj",
  name: "Administração e Locação de Imóvel Comercial - Imobiliária / Locador PF / Locatário PJ",
  description: "Contrato de administração e locação de imóvel comercial entre Imobiliária, Locador Pessoa Física e Locatário Pessoa Jurídica",
  type: "CTR",
  allowedUserTypes: ['AGENCY'],
  propertyType: 'COMMERCIAL',
  landlordType: 'PF',
  tenantType: 'PJ',
  category: 'ADMINISTRATION',
  content: `CONTRATO DE ADMINISTRAÇÃO E LOCAÇÃO DE IMÓVEL COMERCIAL
IMOBILIÁRIA / LOCADOR (PESSOA FÍSICA) / LOCATÁRIO (PESSOA JURÍDICA)

Pelo presente instrumento particular, as partes identificadas abaixo celebram o presente CONTRATO DE ADMINISTRAÇÃO E LOCAÇÃO DE IMÓVEL COMERCIAL, que será regido pela Lei 8.245/91 (Lei do Inquilinato), legislação aplicável e pelas cláusulas seguintes:

────────────────────────────────────────────────────

I – QUALIFICAÇÃO DAS PARTES

────────────────────────────────────────────────────

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

────────────────────────────────────────────────────

2. LOCADOR / PROPRIETÁRIO – PESSOA FÍSICA

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

────────────────────────────────────────────────────

3. LOCATÁRIO – PESSOA JURÍDICA (USO COMERCIAL)

Razão Social: [LOCATARIO_RAZAO_SOCIAL]
Nome Fantasia: [LOCATARIO_NOME_FANTASIA]
CNPJ: [LOCATARIO_CNPJ]
Inscrição Estadual: [LOCATARIO_IE]
Inscrição Municipal: [LOCATARIO_IM]
Endereço da Sede: [LOCATARIO_ENDERECO]
Atividade Econômica (CNAE): [LOCATARIO_CNAE]
E-mail: [LOCATARIO_EMAIL]
Telefone: [LOCATARIO_TELEFONE]

Representante Legal:
Nome: [LOCATARIO_REP_NOME]
Cargo: [LOCATARIO_REP_CARGO]
CPF: [LOCATARIO_REP_CPF]
RG: [LOCATARIO_REP_RG]
Endereço: [LOCATARIO_REP_ENDERECO]

────────────────────────────────────────────────────

4. IMÓVEL OBJETO DA LOCAÇÃO

Endereço Completo: [IMOVEL_ENDERECO]
Bairro / Localidade: [IMOVEL_BAIRRO]
Cidade/UF: [IMOVEL_CIDADE_UF]
CEP: [IMOVEL_CEP]
Tipo do Imóvel: [IMOVEL_TIPO]
Matrícula / Registro Imobiliário: [IMOVEL_MATRICULA]
Cartório de Registro: [IMOVEL_CARTORIO]
Área Construída: [IMOVEL_AREA_CONSTRUIDA] m²
Área Total: [IMOVEL_AREA_TOTAL] m²
Descrição Complementar: [IMOVEL_DESCRICAO]
Mobílias / Equipamentos inclusos: [IMOVEL_MOVEIS_LISTA]
Vagas de Estacionamento: [IMOVEL_VAGAS]
Padrão de Energia: [IMOVEL_ENERGIA]
Condomínio: [IMOVEL_CONDOMINIO]

────────────────────────────────────────────────────

II – FINALIDADE DO CONTRATO

Este instrumento tem por finalidade:
a) autorizar a IMOBILIÁRIA a administrar o imóvel do LOCADOR;
b) reger a locação comercial/não residencial entre LOCADOR e LOCATÁRIO PESSOA JURÍDICA;
c) definir responsabilidades, valores, obrigações e procedimentos de vistoria digital;
d) permitir à LOCATÁRIA a instalação e funcionamento de suas atividades empresariais.

O imóvel destina-se exclusivamente ao uso comercial, para instalação e funcionamento das atividades da empresa LOCATÁRIA, conforme seu objeto social, sendo expressamente vedada a utilização para fins diversos do pactuado, incluindo residencial.

────────────────────────────────────────────────────

III – VALORES, PAGAMENTOS E REPASSES

────────────────────────────────────────────────────

1. VALOR DO ALUGUEL

O aluguel mensal será de R$ [VALOR_ALUGUEL] ([VALOR_ALUGUEL_EXTENSO]), com vencimento todo dia [DIA_VENCIMENTO] de cada mês.

2. REAJUSTE

O aluguel será reajustado anualmente pelo índice [INDICE_REAJUSTE], ou outro índice que venha a substituí-lo, na data de aniversário do contrato, conforme legislação vigente.

Periodicidade: [PERIODICIDADE_REAJUSTE]
Data base do reajuste: [DATA_BASE_REAJUSTE]

3. ENCARGOS DA LOCATÁRIA (PESSOA JURÍDICA)

A LOCATÁRIA pagará integralmente os seguintes encargos:
• IPTU: [RESP_IPTU]
• Condomínio: [RESP_CONDOMINIO]
• Taxa de condomínio extraordinária: [RESP_COND_EXTRAORDINARIA]
• Água: [RESP_AGUA]
• Energia Elétrica: [RESP_ENERGIA]
• Gás: [RESP_GAS]
• Seguro Empresarial contra incêndio e danos: [SEGURO_EMPRESARIAL]
• Valor do seguro: R$ [VALOR_SEGURO]
• Alvará de funcionamento: [RESP_ALVARA]
• Taxas municipais de funcionamento: [RESP_TAXAS_MUNICIPAIS]
• Multas condominiais decorrentes da operação comercial: [RESP_MULTAS_COND]

Os valores poderão ser atualizados automaticamente no sistema conforme reajustes oficiais.

4. TAXA DE ADMINISTRAÇÃO DA IMOBILIÁRIA

A IMOBILIÁRIA receberá [TAXA_ADMINISTRACAO]% sobre o valor mensal do aluguel efetivamente recebido, a título de taxa de administração.

Taxa de Intermediação (primeira locação): [TAXA_INTERMEDIACAO]%
Valor fixo de intermediação (se aplicável): R$ [VALOR_INTERMEDIACAO]

5. REPASSE AO PROPRIETÁRIO

Os repasses ao LOCADOR ocorrerão até o dia [DIA_REPASSE] de cada mês, já descontados:
• taxa de administração da imobiliária
• impostos retidos na fonte (quando aplicável)
• valores de manutenção aprovados
• tarifas bancárias
• multas ou encargos pagos pelo sistema

A IMOBILIÁRIA emitirá demonstrativo digital mensal de repasse.

────────────────────────────────────────────────────

IV – GARANTIAS LOCATÍCIAS

Modalidade de garantia adotada: [TIPO_GARANTIA]
Valor da garantia: R$ [VALOR_GARANTIA]

Dados complementares da garantia:
• Caução em dinheiro: [CAUCAO_VALOR]
• Fiança: [FIADOR_DADOS]
• Seguro-fiança: [SEGURO_FIANCA_DADOS]
• Título de capitalização: [TITULO_CAPITALIZACAO]
• Carta de fiança bancária: [CARTA_FIANCA_BANCARIA]

Regras de devolução: A garantia será devolvida após a vistoria final e quitação de todas as obrigações contratuais.

────────────────────────────────────────────────────

V – VISTORIAS (DIGITAL E PRESENCIAL)

1. VISTORIA INICIAL

Será realizada por meio de laudo digital com fotos, vídeos e assinatura eletrônica:
Data: [DATA_VISTORIA_INICIAL]
Responsável: [RESP_VISTORIA_INICIAL]
Laudo anexo: [ANEXO_VISTORIA_INICIAL]

A LOCATÁRIA terá [PRAZO_CONTESTACAO_VISTORIA] horas para contestar o laudo no aplicativo/sistema.

2. VISTORIA FINAL

O imóvel deverá ser entregue no mesmo estado em que foi recebido, salvo deterioração natural decorrente do uso regular.
Laudo de vistoria final: [ANEXO_VISTORIA_FINAL]

3. AVARIAS E DANOS

Qualquer dano encontrado além do desgaste natural será debitado da LOCATÁRIA, podendo o sistema emitir cobrança automática.

────────────────────────────────────────────────────

VI – PRAZO DO CONTRATO

Este contrato terá duração de [PRAZO_MESES] meses, iniciando em [DATA_INICIO] e terminando em [DATA_FIM].

Renovação: [TIPO_RENOVACAO]
• Automática por igual período
• Mediante negociação entre as partes
• Conforme Lei 8.245/91 (direito de renovação comercial)

A LOCATÁRIA que preencher os requisitos legais terá direito à renovação compulsória do contrato, nos termos dos artigos 51 a 57 da Lei 8.245/91.

────────────────────────────────────────────────────

VII – OBRIGAÇÕES DO LOCADOR

O LOCADOR se compromete a:
1. Garantir a posse pacífica do imóvel durante toda a vigência do contrato.
2. Entregar o imóvel em condições adequadas de uso comercial.
3. Arcar com reparos estruturais (telhado, fundações, instalações hidráulicas e elétricas principais).
4. Informar imediatamente à IMOBILIÁRIA quaisquer mudanças cadastrais.
5. Pagar impostos e taxas atribuídas ao proprietário, quando não repassadas à LOCATÁRIA.
6. Manter documentação do imóvel regularizada.
7. Não perturbar o funcionamento das atividades comerciais da LOCATÁRIA.

────────────────────────────────────────────────────

VIII – OBRIGAÇÕES DA LOCATÁRIA (PESSOA JURÍDICA)

A LOCATÁRIA se compromete a:
1. Utilizar o imóvel exclusivamente para fins comerciais, conforme seu objeto social.
2. Zelar pela integridade do imóvel, instalações e equipamentos.
3. Pagar aluguel e encargos em dia.
4. Permitir vistorias agendadas pela IMOBILIÁRIA ou LOCADOR.
5. Não sublocar, ceder ou emprestar o imóvel sem autorização expressa.
6. Comunicar defeitos estruturais imediatamente.
7. Devolver o imóvel no estado em que recebeu, salvo desgaste natural.
8. Obter e manter em dia todas as licenças, alvarás e autorizações necessárias ao funcionamento.
9. Cumprir as normas do condomínio e legislação municipal aplicável.
10. Arcar com reformas e adaptações necessárias à sua atividade, mediante autorização prévia.
11. Responsabilizar-se por danos causados a terceiros em decorrência de sua atividade.
12. Manter seguro contra incêndio e danos ao imóvel.
13. Não alterar a fachada ou estrutura do imóvel sem autorização escrita.

────────────────────────────────────────────────────

IX – OBRIGAÇÕES DA IMOBILIÁRIA

A IMOBILIÁRIA compromete-se a:
1. Administrar valores, cobranças e repasses com transparência.
2. Notificar atrasos e emitir boletos/faturas.
3. Realizar vistorias com documentação digital e assinatura eletrônica.
4. Guardar documentos e registros pelo prazo legal.
5. Informar o LOCADOR sobre manutenções necessárias.
6. Representar o LOCADOR perante a LOCATÁRIA dentro dos limites deste contrato.
7. Intermediar comunicações entre as partes.
8. Emitir relatórios periódicos de administração.

────────────────────────────────────────────────────

X – BENFEITORIAS E ADAPTAÇÕES

1. Benfeitorias necessárias serão indenizadas, salvo se decorram de culpa da LOCATÁRIA.
2. Benfeitorias úteis serão indenizadas se houver autorização prévia por escrito.
3. Benfeitorias voluptuárias não serão indenizadas, podendo ser retiradas se não causarem dano ao imóvel.

Autorização para benfeitorias: [AUTORIZACAO_BENFEITORIAS]
Limite de valor sem autorização prévia: R$ [LIMITE_BENFEITORIAS]

────────────────────────────────────────────────────

XI – MULTAS, ATRASOS E PENALIDADES

• Multa por atraso no pagamento: [MULTA_ATRASO]% sobre o valor em atraso.
• Juros de mora: [JUROS_ATRASO]% ao mês.
• Correção monetária conforme índice [INDICE_CORRECAO].
• Multa por rescisão antecipada: [VALOR_MULTA_RESCISAO], proporcional ao tempo restante.
• Multa por infração contratual: [MULTA_INFRACAO]% do valor total do contrato.

────────────────────────────────────────────────────

XII – RESCISÃO

1. Rescisão por iniciativa da LOCATÁRIA:
Mediante aviso prévio de [DIAS_AVISO_PREVIO] dias e pagamento de multa proporcional.

2. Rescisão por iniciativa do LOCADOR:
Somente nos casos previstos em lei, respeitando o direito da LOCATÁRIA à renovação.

3. Rescisão por inadimplência:
Após [DIAS_INADIMPLENCIA] dias de atraso, poderá ser iniciada ação de despejo.

4. Rescisão imediata:
Em caso de:
• uso diverso do pactuado
• sublocação não autorizada
• danos ao imóvel
• descumprimento grave das obrigações contratuais
• falência ou recuperação judicial da LOCATÁRIA

────────────────────────────────────────────────────

XIII – DIREITO DE PREFERÊNCIA

Em caso de venda do imóvel, a LOCATÁRIA terá direito de preferência na aquisição, devendo ser notificada com antecedência de [DIAS_PREFERENCIA] dias, conforme Lei 8.245/91.

────────────────────────────────────────────────────

XIV – RESPONSABILIDADE CIVIL

A LOCATÁRIA é exclusivamente responsável por:
• acidentes ocorridos no imóvel
• danos a terceiros
• multas e penalidades decorrentes de sua atividade
• obrigações trabalhistas e previdenciárias de seus funcionários
• débitos fiscais relacionados à sua operação

────────────────────────────────────────────────────

XV – LGPD E USO DE DADOS

As partes autorizam o uso dos dados pelo sistema exclusivamente para:
• registros de vistoria
• geração de documentos contratuais
• notificações e comunicações
• processamento de pagamentos
• auditoria e segurança
• cumprimento de obrigações legais

Os dados serão armazenados e tratados conforme a Lei 13.709/2018 (LGPD).

────────────────────────────────────────────────────

XVI – DOCUMENTOS ANEXOS

• Termo de Vistoria Inicial: [ANEXO_VISTORIA_INICIAL]
• Termo de Vistoria Final: [ANEXO_VISTORIA_FINAL]
• Comprovantes de Garantia: [ANEXO_GARANTIA]
• Contrato Social da LOCATÁRIA: [ANEXO_CONTRATO_SOCIAL]
• Documentos dos representantes legais: [ANEXOS_DOCUMENTOS_REP]
• Certidões do imóvel: [ANEXO_CERTIDOES]
• Alvará de funcionamento: [ANEXO_ALVARA]

────────────────────────────────────────────────────

XVII – DISPOSIÇÕES GERAIS

1. Este contrato obriga as partes e seus sucessores.
2. A tolerância de uma parte não implica novação ou renúncia de direitos.
3. Alterações contratuais somente serão válidas por escrito e assinadas por todas as partes.
4. As comunicações serão feitas por e-mail ou pelo sistema da IMOBILIÁRIA.
5. Este contrato constitui título executivo extrajudicial.

────────────────────────────────────────────────────

XVIII – FORO

Fica eleito o foro da comarca de [FORO_CIDADE_ESTADO] para dirimir quaisquer conflitos oriundos deste contrato, renunciando as partes a qualquer outro, por mais privilegiado que seja.

────────────────────────────────────────────────────

ASSINATURAS DIGITAIS

Documento válido eletronicamente conforme MP 2.200-2/2001 e Lei 14.063/2020.

IMOBILIÁRIA: [IMOBILIARIA_RAZAO_SOCIAL]
Data: [DATA_ASS_IMOBILIARIA]
IP: [IP_IMOBILIARIA]

LOCADOR: [LOCADOR_NOME]
Data: [DATA_ASS_LOCADOR]
IP: [IP_LOCADOR]

LOCATÁRIA (PESSOA JURÍDICA): [LOCATARIO_RAZAO_SOCIAL]
Representada por: [LOCATARIO_REP_NOME]
Cargo: [LOCATARIO_REP_CARGO]
Data: [DATA_ASS_LOCATARIO]
IP: [IP_LOCATARIO]

HASH DO DOCUMENTO: [HASH_DOCUMENTO]`
};

const contratoLocacaoRuralImobiliariaPJ: ContractTemplate = {
  id: "contrato-locacao-rural-imobiliaria-pj",
  name: "Locação de Imóvel Rural - Imobiliária / Locatária PJ",
  description: "Contrato de locação de imóvel rural entre Imobiliária (Administradora) e Locatária Pessoa Jurídica",
  type: "CTR",
  allowedUserTypes: ['AGENCY'],
  propertyType: 'RURAL',
  tenantType: 'PJ',
  category: 'RENTAL',
  content: `CONTRATO DE LOCAÇÃO DE IMÓVEL RURAL
IMOBILIÁRIA (ADMINISTRADORA) / LOCATÁRIA (PESSOA JURÍDICA)

CONTRATO DE LOCAÇÃO DE IMÓVEL RURAL que fazem entre si a IMOBILIÁRIA (ADMINISTRADORA) e a LOCATÁRIA PESSOA JURÍDICA, conforme cláusulas e condições abaixo estabelecidas.

────────────────────────────────────────────────────

1. DAS PARTES

IMOBILIÁRIA / ADMINISTRADORA

Razão Social: [IMOBILIARIA_RAZAO_SOCIAL]
CNPJ: [IMOBILIARIA_CNPJ]
CRECI: [IMOBILIARIA_CRECI]
Endereço Completo: [IMOBILIARIA_ENDERECO]
Representante Legal: [IMOBILIARIA_REPRESENTANTE]
Documento do Representante: [IMOBILIARIA_REP_DOC]
Cargo/Função: [IMOBILIARIA_REP_CARGO]
E-mail: [IMOBILIARIA_EMAIL]
Telefone: [IMOBILIARIA_TELEFONE]


LOCATÁRIA (PESSOA JURÍDICA)

Razão Social: [LOCATARIO_RAZAO_SOCIAL]
Nome Fantasia: [LOCATARIO_NOME_FANTASIA]
CNPJ: [LOCATARIO_CNPJ]
Inscrição Estadual: [LOCATARIO_IE]
Endereço Completo: [LOCATARIO_ENDERECO]
Atividade Econômica (CNAE): [LOCATARIO_CNAE]
E-mail: [LOCATARIO_EMAIL]
Telefone: [LOCATARIO_TELEFONE]

Representante Legal:
Nome: [LOCATARIO_REP_NOME]
Documento (CPF): [LOCATARIO_REP_CPF]
RG: [LOCATARIO_REP_RG]
Cargo: [LOCATARIO_REP_CARGO]
E-mail: [LOCATARIO_REP_EMAIL]
Telefone: [LOCATARIO_REP_TELEFONE]


FIADOR (se houver)

Razão Social ou Nome: [FIADOR_NOME]
Documento/CNPJ: [FIADOR_DOCUMENTO]
Endereço: [FIADOR_ENDERECO]
Telefone: [FIADOR_TELEFONE]
E-mail: [FIADOR_EMAIL]

────────────────────────────────────────────────────

2. DO IMÓVEL RURAL

Localização/Endereço da Propriedade Rural: [IMOVEL_ENDERECO]
Município: [IMOVEL_MUNICIPIO]
Estado: [IMOVEL_ESTADO]
CEP: [IMOVEL_CEP]
Área Total (hectares): [IMOVEL_AREA_HECTARES]
Matrícula no Registro de Imóveis: [IMOVEL_MATRICULA]
Cartório: [IMOVEL_CARTORIO]
Comarca: [IMOVEL_COMARCA]
Perímetro/Limites: [IMOVEL_PERIMETRO]

Recursos Existentes:
• Nascentes: [IMOVEL_NASCENTES]
• Benfeitorias: [IMOVEL_BENFEITORIAS]
• Estruturas Rurais: [IMOVEL_ESTRUTURAS_RURAIS]
• Estradas Internas: [IMOVEL_ESTRADAS_INTERNAS]
• Rede Elétrica: [IMOVEL_REDE_ELETRICA]
• Poços/Água: [IMOVEL_POCOS_AGUA]

Destinação da Propriedade:
[IMOVEL_DESTINACAO_RURAL]
(Ex.: agricultura, pastagem, criação de animais, reflorestamento, agroindústria)

────────────────────────────────────────────────────

3. DO OBJETO DA LOCAÇÃO

O presente contrato tem por objeto a locação do imóvel rural descrito, destinado exclusivamente ao exercício das atividades rurais declaradas pela LOCATÁRIA.

Fica expressamente PROIBIDO:
• Uso diverso da atividade indicada;
• Plantio de culturas ilícitas;
• Danos ambientais de qualquer natureza;
• Desmatamento sem licença ambiental;
• Perfuração de poços sem autorização formal;
• Barramento de cursos d'água sem regularização;
• Queimadas sem autorização dos órgãos competentes;
• Sublocação ou cessão sem autorização expressa;
• Introdução de espécies exóticas invasoras;
• Caça ou pesca predatória.

────────────────────────────────────────────────────

4. DO PRAZO DE LOCAÇÃO

Prazo Total: [PRAZO_MESES] meses
Início: [DATA_INICIO]
Término: [DATA_FIM]

Renovação Automática: [RENOVACAO_AUTOMATICA]
(Sim/Não - Se sim, renova-se por igual período)

Reajuste de prazo somente mediante aditivo contratual assinado por ambas as partes.

Observação: Conforme o Estatuto da Terra (Lei 4.504/64), contratos de arrendamento rural têm prazo mínimo de 3 anos.

────────────────────────────────────────────────────

5. DO VALOR, PAGAMENTO E REAJUSTE

Valor da Locação: R$ [VALOR_ALUGUEL] ([VALOR_ALUGUEL_EXTENSO])
Periodicidade: [PERIODICIDADE_PAGAMENTO]
(Mensal / Trimestral / Semestral / Anual / Por safra)

Forma de Pagamento:
• Plataforma Digital: [PLATAFORMA_PAGAMENTO]
• Vencimento: Dia [DIA_VENCIMENTO] de cada período

Dados Bancários (se aplicável):
• Banco: [BANCO]
• Agência: [AGENCIA]
• Conta: [CONTA]
• Chave PIX: [CHAVE_PIX]

Encargos Financeiros por Atraso:
• Multa por atraso: [MULTA_ATRASO]% sobre o valor
• Juros de mora: [JUROS_ATRASO]% ao mês
• Correção monetária: [INDICE_REAJUSTE]

Reajuste Anual:
Índice: [INDICE_REAJUSTE] (IGP-M, IPCA, INPC ou outro)
Data Base: [DATA_BASE_REAJUSTE]

────────────────────────────────────────────────────

6. DOS ENCARGOS E RESPONSABILIDADES FINANCEIRAS

RESPONSABILIDADE DA LOCATÁRIA:

• ITR (Imposto Territorial Rural): [RESP_ITR]
• Licenças Ambientais: [RESP_LICENCAS_AMBIENTAIS]
• CAR (Cadastro Ambiental Rural): [RESP_CAR]
• CCIR (se aplicável): [RESP_CCIR]
• Manutenção de Cercas: [RESP_CERCAS]
• Energia Elétrica: [RESP_ENERGIA]
• Água, Bombas e Poços: [RESP_AGUA]
• Taxas de Fiscalização Estadual/Municipal: [RESP_TAXAS_FISCALIZACAO]
• Seguro da Propriedade Rural: [RESP_SEGURO_RURAL]
• Manutenção de Estradas Internas: [RESP_ESTRADAS]
• Custos com Insumos e Produção: [RESP_INSUMOS]

RESPONSABILIDADE DA IMOBILIÁRIA/LOCADOR:

• Fornecer documentação regular do imóvel (matrícula, CAR, CCIR, ITR quitado);
• Manutenção da estrutura física de origem (benfeitorias pré-existentes);
• Garantir a posse pacífica do imóvel;
• Não impedir o uso regular do imóvel;
• Reparos estruturais que não decorram do uso pela locatária.

────────────────────────────────────────────────────

7. DAS VISTORIAS

Será realizada vistoria completa do imóvel rural:

VISTORIA INICIAL
Data: [DATA_VISTORIA_INICIAL]
Responsável: [RESP_VISTORIA_INICIAL]
Laudo/Anexo: [ANEXO_VISTORIA_INICIAL]

VISTORIA FINAL
Data: [DATA_VISTORIA_FINAL]
Laudo/Anexo: [ANEXO_VISTORIA_FINAL]

As vistorias incluirão:
• Registro fotográfico georreferenciado;
• Estado das benfeitorias;
• Condição das pastagens e culturas;
• Estruturas rurais (currais, barracões, silos, etc.);
• Equipamentos e máquinas (se inclusos);
• Estado ambiental (APPs, reserva legal, nascentes);
• Cercas, porteiras e estradas internas.

Prazo para Contestação: [PRAZO_CONTESTACAO_VISTORIA] horas após emissão do laudo.

────────────────────────────────────────────────────

8. DAS OBRIGAÇÕES DAS PARTES

OBRIGAÇÕES DA LOCATÁRIA:

1. Utilizar o imóvel exclusivamente conforme atividade declarada.
2. Manter áreas de preservação permanente (APP) e reserva legal intactas.
3. Cumprir todas as normas ambientais, sanitárias e rurais aplicáveis.
4. Devolver o imóvel nas mesmas condições em que foi recebido, salvo desgaste natural.
5. Repor cercas, porteiras, currais e barracões, se danificados pelo uso.
6. Comunicar imediatamente sinistros, incêndios, invasões ou danos ambientais.
7. Obter e manter em dia todas as licenças ambientais, fitossanitárias e de uso rural.
8. Não realizar desmatamento ou queimadas sem autorização.
9. Preservar nascentes e cursos d'água.
10. Permitir vistorias agendadas pela IMOBILIÁRIA.
11. Não sublocar ou ceder sem autorização expressa.
12. Manter seguro contra sinistros rurais (se exigido).

OBRIGAÇÕES DA IMOBILIÁRIA/LOCADOR:

1. Garantir a posse pacífica do imóvel durante toda a vigência.
2. Manter documentação fundiária regular e atualizada.
3. Realizar reparos estruturais que não sejam decorrentes do uso da locatária.
4. Não interferir nas atividades rurais da locatária.
5. Entregar o imóvel em condições adequadas de uso.
6. Fornecer cópias de documentos necessários (CAR, CCIR, matrícula).

────────────────────────────────────────────────────

9. DAS BENFEITORIAS

BENFEITORIAS NECESSÁRIAS:
Serão indenizadas mediante apresentação de prova documental (notas fiscais, contratos, laudos técnicos).

BENFEITORIAS ÚTEIS:
Serão indenizadas apenas se houver autorização prévia por escrito da IMOBILIÁRIA.
Autorização para Benfeitorias Úteis: [AUTORIZACAO_BENFEITORIAS]
Limite de Valor sem Autorização: R$ [LIMITE_BENFEITORIAS]

BENFEITORIAS VOLUPTUÁRIAS:
Não serão indenizadas, podendo ser retiradas se não causarem dano ao imóvel.

────────────────────────────────────────────────────

10. DA RESCISÃO

O contrato poderá ser rescindido nos seguintes casos:

• Inadimplência superior a [DIAS_INADIMPLENCIA] dias;
• Dano ambiental comprovado;
• Uso irregular ou diverso do pactuado;
• Prática de atividades ilícitas;
• Sublocação ou cessão não autorizada;
• Falta de licenças ambientais obrigatórias;
• Abandono da área por período superior a [DIAS_ABANDONO] dias;
• Descumprimento grave das obrigações contratuais;
• Por acordo mútuo entre as partes.

Multa Rescisória: R$ [VALOR_MULTA_RESCISAO] ([VALOR_MULTA_RESCISAO_EXTENSO])
Aviso Prévio Mínimo: [DIAS_AVISO_PREVIO] dias

Em caso de rescisão por culpa da LOCATÁRIA, perderá esta o direito à indenização por benfeitorias úteis e voluptuárias.

────────────────────────────────────────────────────

11. DO DIREITO DE PREFERÊNCIA

Em caso de venda do imóvel, a LOCATÁRIA terá direito de preferência na aquisição, devendo ser notificada com antecedência mínima de [DIAS_PREFERENCIA] dias, nos termos do Estatuto da Terra.

────────────────────────────────────────────────────

12. DA LEGISLAÇÃO APLICÁVEL

Este contrato é regido pelas seguintes normas:
• Estatuto da Terra (Lei 4.504/1964);
• Decreto 59.566/1966 (Arrendamento e Parceria Rural);
• Código Civil Brasileiro;
• Legislação ambiental aplicável (Código Florestal, Lei 12.651/2012);
• Lei 8.245/91 (Lei do Inquilinato) no que couber.

────────────────────────────────────────────────────

13. DA LGPD E TRATAMENTO DE DADOS

As partes autorizam o uso dos dados pessoais e empresariais exclusivamente para:
• Administração do contrato;
• Geração de documentos e laudos;
• Cobranças e pagamentos;
• Comunicações e notificações;
• Auditorias e segurança;
• Cumprimento de obrigações legais.

Os dados serão armazenados e tratados conforme a Lei 13.709/2018 (LGPD).

────────────────────────────────────────────────────

14. DO FORO

Fica eleito o foro da comarca de [FORO_CIDADE_ESTADO] para dirimir quaisquer litígios oriundos deste contrato, renunciando as partes a qualquer outro, por mais privilegiado que seja.

ASSINATURAS ELETRÔNICAS

Documento válido eletronicamente conforme MP 2.200-2/2001 e Lei 14.063/2020.

IMOBILIÁRIA: [IMOBILIARIA_RAZAO_SOCIAL]
Representante: [IMOBILIARIA_REPRESENTANTE]
Data: [DATA_ASS_IMOBILIARIA]
IP: [IP_IMOBILIARIA]

LOCATÁRIA (PESSOA JURÍDICA): [LOCATARIO_RAZAO_SOCIAL]
Representante: [LOCATARIO_REP_NOME]
Cargo: [LOCATARIO_REP_CARGO]
Data: [DATA_ASS_LOCATARIO]
IP: [IP_LOCATARIO]

FIADOR (se houver): [FIADOR_NOME]
Data: [DATA_ASS_FIADOR]
IP: [IP_FIADOR]

HASH DO DOCUMENTO: [HASH_DOCUMENTO]
DATA E HORA DE REGISTRO: [DATA_HORA_REGISTRO]`
};

const contratoAdministracaoLocacaoResidencialPJ: ContractTemplate = {
  id: "contrato-administracao-locacao-residencial-pj",
  name: "Administração e Locação Residencial - Imobiliária / Locador PF / Locatário PJ",
  description: "Contrato de administração de imóvel e locação residencial entre Imobiliária, Locador Pessoa Física e Locatário Pessoa Jurídica (para uso de colaboradores)",
  type: "CTR",
  allowedUserTypes: ['AGENCY'],
  propertyType: 'RESIDENTIAL',
  landlordType: 'PF',
  tenantType: 'PJ',
  category: 'ADMINISTRATION',
  content: `CONTRATO DE ADMINISTRAÇÃO DE IMÓVEL E LOCAÇÃO RESIDENCIAL
IMOBILIÁRIA / LOCADOR (PESSOA FÍSICA) / LOCATÁRIO (PESSOA JURÍDICA)

Pelo presente instrumento, as partes qualificadas a seguir celebram o presente CONTRATO DE ADMINISTRAÇÃO DE IMÓVEL E LOCAÇÃO RESIDENCIAL, regido pela Lei 8.245/1991 (Lei do Inquilinato), Código Civil e demais normas aplicáveis.

────────────────────────────────────────────────────

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

────────────────────────────────────────────────────

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

────────────────────────────────────────────────────

3. LOCATÁRIO – PESSOA JURÍDICA

Razão Social: [LOCATARIO_RAZAO_SOCIAL]
Nome Fantasia: [LOCATARIO_NOME_FANTASIA]
CNPJ: [LOCATARIO_CNPJ]
Inscrição Estadual: [LOCATARIO_IE]
Inscrição Municipal: [LOCATARIO_IM]
Endereço da Sede: [LOCATARIO_ENDERECO]
Atividade Econômica (CNAE): [LOCATARIO_CNAE]
E-mail Institucional: [LOCATARIO_EMAIL]
Telefone: [LOCATARIO_TELEFONE]

Representante Legal:
Nome: [LOCATARIO_REP_NOME]
Cargo: [LOCATARIO_REP_CARGO]
CPF: [LOCATARIO_REP_CPF]
RG: [LOCATARIO_REP_RG]
Endereço: [LOCATARIO_REP_ENDERECO]
E-mail: [LOCATARIO_REP_EMAIL]
Telefone: [LOCATARIO_REP_TELEFONE]

────────────────────────────────────────────────────

4. IMÓVEL OBJETO

Endereço Completo: [IMOVEL_ENDERECO]
Bairro: [IMOVEL_BAIRRO]
Cidade/UF: [IMOVEL_CIDADE_UF]
CEP: [IMOVEL_CEP]
Tipo: [IMOVEL_TIPO]
Matrícula / Registro Imobiliário: [IMOVEL_MATRICULA]
Cartório: [IMOVEL_CARTORIO]
Área Construída: [IMOVEL_AREA_CONSTRUIDA] m²
Descrição Complementar: [IMOVEL_DESCRICAO]
Mobílias / Itens inclusos: [IMOVEL_MOVEIS_LISTA]
Padrão de Energia: [IMOVEL_ENERGIA]
Condomínio: [IMOVEL_CONDOMINIO]
Valor Condomínio: R$ [IMOVEL_CONDOMINIO_VALOR]
IPTU Anual: R$ [IMOVEL_IPTU_VALOR]

────────────────────────────────────────────────────

II – FINALIDADE DO CONTRATO

────────────────────────────────────────────────────

Este instrumento tem por finalidade:

a) autorizar a IMOBILIÁRIA a administrar o imóvel do LOCADOR;
b) regular a locação residencial para uso dos colaboradores/prepostos da pessoa jurídica;
c) definir obrigações, pagamentos e responsabilidades.

O imóvel destina-se EXCLUSIVAMENTE para fins RESIDENCIAIS, para moradia de colaboradores, funcionários ou prepostos da LOCATÁRIA, ficando expressamente VEDADO:
• Sublocação a terceiros;
• Uso comercial, industrial ou de serviços;
• Hospedagem remunerada (Airbnb, hotelaria, etc.);
• Cessão a pessoas não vinculadas à empresa.

────────────────────────────────────────────────────

III – VALORES, PAGAMENTOS E REPASSES

────────────────────────────────────────────────────

1. VALOR DO ALUGUEL

O aluguel mensal será de R$ [VALOR_ALUGUEL] ([VALOR_ALUGUEL_EXTENSO]), com vencimento todo dia [DIA_VENCIMENTO] de cada mês.

2. REAJUSTE

O aluguel será reajustado anualmente pelo índice [INDICE_REAJUSTE] (IGPM/IPCA/INPC), ou outro que venha a substituí-lo, na data de aniversário do contrato, conforme legislação vigente.

Periodicidade: [PERIODICIDADE_REAJUSTE]
Data Base: [DATA_BASE_REAJUSTE]

3. ENCARGOS DO LOCATÁRIO (PESSOA JURÍDICA)

A LOCATÁRIA PJ assume integralmente:
• Água: [RESP_AGUA]
• Gás: [RESP_GAS]
• Energia Elétrica: [RESP_ENERGIA]
• Condomínio (ordinário): [RESP_CONDOMINIO]
• Taxa de condomínio extraordinária: [RESP_COND_EXTRAORDINARIA]
• IPTU (parcelado ou anual): [RESP_IPTU]
• Seguro incêndio obrigatório: R$ [SEGURO_INCENDIO_VALOR]
• Multas condominiais: [RESP_MULTAS_COND]

Observação: Todos os valores poderão ser atualizados e cobrados pelo sistema automaticamente.

4. TAXA DE ADMINISTRAÇÃO DA IMOBILIÁRIA

A IMOBILIÁRIA receberá [TAXA_ADMINISTRACAO]% sobre o valor mensal do aluguel efetivamente recebido, a título de taxa de administração.

Taxa de Intermediação (primeira locação): [TAXA_INTERMEDIACAO]%
Valor fixo de intermediação (se aplicável): R$ [VALOR_INTERMEDIACAO]

5. REPASSE AO PROPRIETÁRIO

Os repasses ao LOCADOR ocorrerão até o dia [DIA_REPASSE] de cada mês, já descontados:
• taxa de administração da imobiliária
• manutenções autorizadas
• impostos retidos na fonte (quando aplicável)
• tarifas bancárias
• multas ou encargos pagos via sistema

A IMOBILIÁRIA emitirá demonstrativo digital mensal de repasse.

────────────────────────────────────────────────────

IV – GARANTIAS LOCATÍCIAS

────────────────────────────────────────────────────

Modalidade de garantia adotada: [TIPO_GARANTIA]
(Caução / Seguro Fiança / Título de Capitalização / Fiador PJ / Fiador PF / Sem garantia)

Valor da garantia: R$ [VALOR_GARANTIA]

Dados complementares da garantia:
• Caução em dinheiro: [CAUCAO_VALOR]
• Fiança (dados do fiador): [FIADOR_DADOS]
• Seguro-fiança: [SEGURO_FIANCA_DADOS]
• Título de capitalização: [TITULO_CAPITALIZACAO]
• Carta de fiança bancária: [CARTA_FIANCA_BANCARIA]

Regras de restituição: A garantia será restituída ao término do contrato, após a vistoria final e quitação de todas as obrigações contratuais.

────────────────────────────────────────────────────

V – VISTORIAS (DIGITAL E PRESENCIAL)

────────────────────────────────────────────────────

1. VISTORIA INICIAL

Realizada por laudo digital, incluindo fotos, vídeos e assinatura eletrônica.
Data: [DATA_VISTORIA_INICIAL]
Responsável: [RESP_VISTORIA_INICIAL]
Laudo anexo: [ANEXO_VISTORIA_INICIAL]

A LOCATÁRIA PJ terá [PRAZO_CONTESTACAO_VISTORIA] horas para contestação no sistema.

2. VISTORIA FINAL

Será comparativa ao laudo inicial, devendo o imóvel ser devolvido nas mesmas condições, exceto desgaste natural pelo uso regular.
Data prevista: [DATA_VISTORIA_FINAL]
Laudo anexo: [ANEXO_VISTORIA_FINAL]

3. AVARIAS E DANOS

Danos causados por funcionários, hóspedes, colaboradores ou terceiros vinculados à empresa serão devidamente cobrados da LOCATÁRIA, podendo o sistema emitir cobrança automática.

────────────────────────────────────────────────────

VI – OBRIGAÇÕES DO LOCADOR

O LOCADOR se compromete a:

1. Garantir a posse pacífica do imóvel durante toda a vigência do contrato.
2. Fornecer o imóvel em condições adequadas de habitabilidade.
3. Realizar reparos estruturais (telhado, fundações, instalações hidráulicas e elétricas principais).
4. Manter impostos do proprietário em dia, quando não atribuídos à locatária.
5. Informar imediatamente à IMOBILIÁRIA quaisquer mudanças cadastrais.
6. Fornecer documentação necessária para a locação.

────────────────────────────────────────────────────

VII – OBRIGAÇÕES DA LOCATÁRIA (PESSOA JURÍDICA)

A LOCATÁRIA se compromete a:

1. Utilizar o imóvel exclusivamente para moradia de colaboradores da empresa.
2. Indicar nominalmente os ocupantes autorizados: [OCUPANTES_AUTORIZADOS]
3. Comunicar previamente qualquer alteração nos ocupantes autorizados.
4. Zelar pelo imóvel, mobiliário e áreas comuns do condomínio.
5. Permitir vistorias agendadas pela IMOBILIÁRIA ou LOCADOR.
6. Comunicar danos, defeitos e necessidades de manutenção imediatamente.
7. Pagar pontualmente o aluguel e todos os encargos.
8. Não alterar a estrutura do imóvel sem autorização prévia por escrito.
9. Cumprir as normas do condomínio e legislação municipal aplicável.
10. Devolver o imóvel conforme laudo de vistoria inicial, salvo desgaste natural.
11. Não sublocar, ceder ou emprestar o imóvel sem autorização expressa.
12. Responsabilizar-se por danos causados por seus colaboradores ou visitantes.
13. Manter seguro contra incêndio e danos ao imóvel.

────────────────────────────────────────────────────

VIII – OBRIGAÇÕES DA IMOBILIÁRIA

A IMOBILIÁRIA compromete-se a:

1. Administrar pagamentos, cobranças e repasses com transparência.
2. Emitir boletos e notificações automáticas de vencimento e atraso.
3. Realizar vistorias com documentação digital e assinatura eletrônica.
4. Intermediar a comunicação entre LOCADOR e LOCATÁRIA.
5. Gerenciar documentos e arquivos digitais pelo prazo legal.
6. Executar procedimentos de cobrança e conciliação.
7. Informar o LOCADOR sobre manutenções necessárias.
8. Emitir relatórios periódicos de administração.

────────────────────────────────────────────────────

IX – MULTAS, ATRASOS E PENALIDADES

• Multa por atraso no pagamento: [MULTA_ATRASO]% sobre o valor vencido.
• Juros moratórios: [JUROS_ATRASO]% ao mês.
• Correção monetária conforme índice [INDICE_CORRECAO].
• Multa por rescisão antecipada: [MULTA_RESCISAO_MESES] meses de aluguel, proporcional ao tempo restante.
• Multa por infração contratual: [MULTA_INFRACAO]% do valor total do contrato.

────────────────────────────────────────────────────

X – PRAZO DO CONTRATO

Este contrato terá duração de [PRAZO_MESES] meses, com início em [DATA_INICIO] e término em [DATA_FIM].

Renovação: [TIPO_RENOVACAO]
• Automática por igual período, mediante liberação do proprietário
• Mediante negociação entre as partes
• Conforme regras do sistema

────────────────────────────────────────────────────

XI – RESCISÃO

O contrato poderá ser rescindido nos seguintes casos:

1. Por inadimplência superior a [DIAS_INADIMPLENCIA] dias.
2. Por uso indevido ou diverso do pactuado.
3. Por danos ao imóvel causados por negligência ou mau uso.
4. Por descumprimento grave de normas condominiais.
5. Por sublocação ou cessão não autorizada.
6. Por acordo mútuo entre as partes.

Advertência — Suspensão — Rescisão imediata conforme gravidade da infração.

Aviso prévio: [DIAS_AVISO_PREVIO] dias quando a rescisão ocorrer sem causa específica.

Em caso de rescisão antecipada pela LOCATÁRIA, será devida multa proporcional ao tempo restante do contrato.

────────────────────────────────────────────────────

XII – LGPD E TRATAMENTO DE DADOS

A IMOBILIÁRIA poderá armazenar e tratar os dados pessoais e empresariais exclusivamente para:
• emissão de documentos contratuais
• geração de laudos e vistorias
• cobranças e pagamentos
• segurança e auditorias
• integração com APIs bancárias e gateways de pagamento
• cumprimento de obrigações legais

Os dados serão armazenados e tratados conforme a Lei 13.709/2018 (LGPD).

────────────────────────────────────────────────────

XIII – DOCUMENTOS ANEXOS

• Laudo de Vistoria Inicial: [ANEXO_VISTORIA_INICIAL]
• Laudo de Vistoria Final: [ANEXO_VISTORIA_FINAL]
• Contrato Social e Documentos da Pessoa Jurídica: [ANEXO_CONTRATO_SOCIAL]
• Documentos dos Representantes Legais: [ANEXOS_DOCUMENTOS_REP]
• Comprovantes de Garantia: [ANEXO_GARANTIA]
• Certidões do Imóvel: [ANEXO_CERTIDOES]

────────────────────────────────────────────────────

XIV – FORO

Fica eleito o foro da comarca de [FORO_CIDADE_ESTADO] para dirimir quaisquer litígios oriundos deste contrato, renunciando as partes a qualquer outro, por mais privilegiado que seja.

────────────────────────────────────────────────────

XV – ASSINATURA DIGITAL E VALIDADE

Documento válido eletronicamente conforme MP 2.200-2/2001 e Lei 14.063/2020.

HASH DO DOCUMENTO: [HASH_DOCUMENTO]

IPs de Registro:
• Imobiliária: [IP_IMOBILIARIA]
• Locador: [IP_LOCADOR]
• Locatária PJ: [IP_LOCATARIO]


ASSINAM DIGITALMENTE:

LOCADOR: [LOCADOR_NOME]
Data: [DATA_ASS_LOCADOR]

LOCATÁRIA (PESSOA JURÍDICA): [LOCATARIO_RAZAO_SOCIAL]
Representada por: [LOCATARIO_REP_NOME]
Cargo: [LOCATARIO_REP_CARGO]
Data: [DATA_ASS_LOCATARIO]

IMOBILIÁRIA: [IMOBILIARIA_RAZAO_SOCIAL]
Representada por: [IMOBILIARIA_REPRESENTANTE]
Data: [DATA_ASS_IMOBILIARIA]`
};

const contratoAdministracaoImovelLocadorPfLocatarioPf: ContractTemplate = {
  id: "contrato-administracao-imovel-locador-pf-locatario-pf",
  name: "Administração de Imóvel e Locação Residencial - Imobiliária / Locador PF / Locatário PF",
  description: "Contrato de administração de imóvel e locação residencial entre Imobiliária, Locador Pessoa Física e Locatário Pessoa Física",
  type: "CTR",
  allowedUserTypes: ['AGENCY'],
  propertyType: 'RESIDENTIAL',
  landlordType: 'PF',
  tenantType: 'PF',
  category: 'ADMINISTRATION',
  content: `
════════════════════════════════════════════════════════════════════════════════
                    CONTRATO DE ADMINISTRAÇÃO DE IMÓVEL
            IMOBILIÁRIA / LOCADOR (PESSOA FÍSICA) / LOCATÁRIO (PESSOA FÍSICA)
════════════════════════════════════════════════════════════════════════════════

────────────────────────────────────────────────────
I – QUALIFICAÇÃO DAS PARTES

IMOBILIÁRIA (ADMINISTRADORA):
• Razão Social: [IMOBILIARIA_RAZAO_SOCIAL]
• Nome Fantasia: [IMOBILIARIA_NOME_FANTASIA]
• CNPJ: [IMOBILIARIA_CNPJ]
• CRECI: [IMOBILIARIA_CRECI]
• Endereço: [IMOBILIARIA_ENDERECO], [IMOBILIARIA_NUMERO], [IMOBILIARIA_COMPLEMENTO]
• Bairro: [IMOBILIARIA_BAIRRO] - CEP: [IMOBILIARIA_CEP]
• Cidade/UF: [IMOBILIARIA_CIDADE]/[IMOBILIARIA_ESTADO]
• Telefone: [IMOBILIARIA_TELEFONE]
• E-mail: [IMOBILIARIA_EMAIL]
• Representante Legal: [IMOBILIARIA_REPRESENTANTE]
• CPF do Representante: [IMOBILIARIA_REP_CPF]

LOCADOR (PROPRIETÁRIO - PESSOA FÍSICA):
• Nome Completo: [LOCADOR_NOME]
• CPF: [LOCADOR_CPF]
• RG: [LOCADOR_RG] - Órgão Emissor: [LOCADOR_RG_ORGAO]
• Estado Civil: [LOCADOR_ESTADO_CIVIL]
• Profissão: [LOCADOR_PROFISSAO]
• Nacionalidade: [LOCADOR_NACIONALIDADE]
• Data de Nascimento: [LOCADOR_DATA_NASCIMENTO]
• Endereço: [LOCADOR_ENDERECO], [LOCADOR_NUMERO], [LOCADOR_COMPLEMENTO]
• Bairro: [LOCADOR_BAIRRO] - CEP: [LOCADOR_CEP]
• Cidade/UF: [LOCADOR_CIDADE]/[LOCADOR_ESTADO]
• Telefone: [LOCADOR_TELEFONE]
• E-mail: [LOCADOR_EMAIL]

LOCATÁRIO (PESSOA FÍSICA):
• Nome Completo: [LOCATARIO_NOME]
• CPF: [LOCATARIO_CPF]
• RG: [LOCATARIO_RG] - Órgão Emissor: [LOCATARIO_RG_ORGAO]
• Estado Civil: [LOCATARIO_ESTADO_CIVIL]
• Profissão: [LOCATARIO_PROFISSAO]
• Nacionalidade: [LOCATARIO_NACIONALIDADE]
• Data de Nascimento: [LOCATARIO_DATA_NASCIMENTO]
• Endereço Atual: [LOCATARIO_ENDERECO], [LOCATARIO_NUMERO], [LOCATARIO_COMPLEMENTO]
• Bairro: [LOCATARIO_BAIRRO] - CEP: [LOCATARIO_CEP]
• Cidade/UF: [LOCATARIO_CIDADE]/[LOCATARIO_ESTADO]
• Telefone: [LOCATARIO_TELEFONE]
• E-mail: [LOCATARIO_EMAIL]

CÔNJUGE DO LOCATÁRIO (se aplicável):
• Nome Completo: [CONJUGE_LOCATARIO_NOME]
• CPF: [CONJUGE_LOCATARIO_CPF]
• RG: [CONJUGE_LOCATARIO_RG]

────────────────────────────────────────────────────
II – DO OBJETO

O presente contrato tem por objeto a ADMINISTRAÇÃO, pela IMOBILIÁRIA, do imóvel descrito abaixo, de propriedade do LOCADOR, e sua subsequente LOCAÇÃO ao LOCATÁRIO, para fins exclusivamente residenciais.

DESCRIÇÃO DO IMÓVEL:
• Tipo: [IMOVEL_TIPO]
• Endereço: [IMOVEL_ENDERECO], [IMOVEL_NUMERO], [IMOVEL_COMPLEMENTO]
• Bairro: [IMOVEL_BAIRRO] - CEP: [IMOVEL_CEP]
• Cidade/UF: [IMOVEL_CIDADE]/[IMOVEL_ESTADO]
• Matrícula: [IMOVEL_MATRICULA]
• Cartório: [IMOVEL_CARTORIO]
• Inscrição Municipal (IPTU): [IMOVEL_INSCRICAO_IPTU]
• Área Construída: [IMOVEL_AREA_CONSTRUIDA] m²
• Área Total: [IMOVEL_AREA_TOTAL] m²

CARACTERÍSTICAS DO IMÓVEL:
• Quartos: [IMOVEL_QUARTOS]
• Suítes: [IMOVEL_SUITES]
• Banheiros: [IMOVEL_BANHEIROS]
• Salas: [IMOVEL_SALAS]
• Vagas de Garagem: [IMOVEL_VAGAS]
• Condomínio: [IMOVEL_CONDOMINIO]
• Observações: [IMOVEL_OBSERVACOES]

O imóvel destina-se exclusivamente ao uso RESIDENCIAL do LOCATÁRIO e de sua família, sendo vedada qualquer outra finalidade ou a sublocação, total ou parcial, sem prévia e expressa autorização por escrito da IMOBILIÁRIA e do LOCADOR.

────────────────────────────────────────────────────
III – DOS VALORES E FORMA DE PAGAMENTO

§1º VALOR DO ALUGUEL:
O valor mensal do aluguel é de R$ [VALOR_ALUGUEL] ([VALOR_ALUGUEL_EXTENSO]), a ser pago até o dia [DIA_VENCIMENTO] de cada mês.

§2º REAJUSTE ANUAL:
O aluguel será reajustado anualmente pelo índice [INDICE_REAJUSTE] (ou outro índice que vier a substituí-lo), na data de aniversário do contrato.

§3º ENCARGOS E TAXAS:
• IPTU: Responsabilidade do [RESP_IPTU] - Valor anual: R$ [IMOVEL_IPTU_VALOR]
• Condomínio: Responsabilidade do [RESP_CONDOMINIO] - Valor médio: R$ [IMOVEL_CONDOMINIO_VALOR]
• Água: Responsabilidade do [RESP_AGUA]
• Luz: Responsabilidade do [RESP_LUZ]
• Gás: Responsabilidade do [RESP_GAS]
• Taxa de Incêndio: Responsabilidade do [RESP_TAXA_INCENDIO]

§4º FORMA DE PAGAMENTO:
Os pagamentos serão realizados exclusivamente através da plataforma da IMOBILIÁRIA, mediante boleto bancário, PIX ou transferência bancária, para a conta indicada.

§5º MULTA POR ATRASO:
O atraso no pagamento acarretará:
• Multa de [MULTA_ATRASO_PERCENTUAL]% sobre o valor devido
• Juros de mora de [JUROS_MORA_PERCENTUAL]% ao mês
• Correção monetária pelo [INDICE_CORRECAO]

§6º TAXA DE ADMINISTRAÇÃO:
A IMOBILIÁRIA receberá do LOCADOR, a título de taxa de administração, o valor correspondente a [TAXA_ADMINISTRACAO_PERCENTUAL]% do aluguel mensal recebido.

────────────────────────────────────────────────────
IV – DAS GARANTIAS LOCATÍCIAS

§1º MODALIDADE DE GARANTIA:
O presente contrato é garantido por: [GARANTIA_TIPO]

§2º ESPECIFICAÇÃO DA GARANTIA:

a) CAUÇÃO EM DINHEIRO:
• Valor: R$ [CAUCAO_VALOR] ([CAUCAO_VALOR_EXTENSO])
• Equivalente a [CAUCAO_MESES] meses de aluguel
• Depositado em: [CAUCAO_BANCO]
• Conta: [CAUCAO_CONTA]
• Data do depósito: [CAUCAO_DATA_DEPOSITO]

b) FIADOR (se aplicável):
• Nome: [FIADOR_NOME]
• CPF: [FIADOR_CPF]
• RG: [FIADOR_RG]
• Estado Civil: [FIADOR_ESTADO_CIVIL]
• Profissão: [FIADOR_PROFISSAO]
• Endereço: [FIADOR_ENDERECO], [FIADOR_NUMERO]
• Bairro: [FIADOR_BAIRRO] - CEP: [FIADOR_CEP]
• Cidade/UF: [FIADOR_CIDADE]/[FIADOR_ESTADO]
• Telefone: [FIADOR_TELEFONE]
• E-mail: [FIADOR_EMAIL]
• Imóvel oferecido em garantia: [FIADOR_IMOVEL_GARANTIA]
• Matrícula do imóvel: [FIADOR_IMOVEL_MATRICULA]

c) SEGURO FIANÇA (se aplicável):
• Seguradora: [SEGURO_FIANCA_EMPRESA]
• Apólice nº: [SEGURO_FIANCA_APOLICE]
• Vigência: [SEGURO_FIANCA_VIGENCIA]
• Cobertura: R$ [SEGURO_FIANCA_COBERTURA]

d) TÍTULO DE CAPITALIZAÇÃO (se aplicável):
• Instituição: [TITULO_CAP_INSTITUICAO]
• Número: [TITULO_CAP_NUMERO]
• Valor: R$ [TITULO_CAP_VALOR]

§3º RENOVAÇÃO DA GARANTIA:
O LOCATÁRIO se obriga a manter a garantia válida durante toda a vigência do contrato, incluindo eventuais prorrogações.

────────────────────────────────────────────────────
V – DA VISTORIA DO IMÓVEL

§1º VISTORIA INICIAL:
Antes da entrega das chaves, será realizada VISTORIA INICIAL do imóvel, com registro detalhado de:
• Estado de conservação de pisos, paredes, tetos e esquadrias
• Funcionamento de instalações elétricas, hidráulicas e sanitárias
• Condições de pintura e revestimentos
• Estado de equipamentos e acessórios existentes
• Registro fotográfico completo

O Laudo de Vistoria Inicial integrará o presente contrato como ANEXO I.

§2º VISTORIA FINAL:
Ao término da locação, será realizada VISTORIA FINAL para comparação com o estado inicial, observando:
• Desgastes naturais pelo uso normal são aceitos
• Danos além do desgaste natural deverão ser reparados pelo LOCATÁRIO
• O LOCATÁRIO deverá entregar o imóvel nas mesmas condições em que recebeu

§3º VISTORIA PERIÓDICA:
A IMOBILIÁRIA poderá realizar vistorias periódicas, mediante agendamento prévio de [PRAZO_AGENDAMENTO_VISTORIA] horas com o LOCATÁRIO.

§4º SISTEMA DE VISTORIA DIGITAL:
Todas as vistorias serão registradas no sistema MR3X, com:
• Laudo digital com fotos datadas e georreferenciadas
• Assinatura digital das partes
• Hash de autenticidade
• Disponibilidade para consulta online

────────────────────────────────────────────────────
VI – DAS OBRIGAÇÕES DO LOCADOR

O LOCADOR obriga-se a:

6.1. Entregar o imóvel em condições de servir ao uso a que se destina, com todas as instalações em perfeito funcionamento.

6.2. Garantir ao LOCATÁRIO o uso pacífico do imóvel durante a vigência da locação.

6.3. Manter a forma e o destino do imóvel locado.

6.4. Responder pelos vícios ou defeitos anteriores à locação.

6.5. Realizar os reparos estruturais necessários, não decorrentes do uso normal.

6.6. Fornecer os documentos necessários para a regularização de concessionárias.

6.7. Pagar os encargos e tributos que incidam sobre o imóvel, de sua responsabilidade conforme cláusula III.

6.8. Comunicar à IMOBILIÁRIA qualquer alteração de seus dados cadastrais.

6.9. Fornecer a documentação atualizada do imóvel sempre que solicitado.

6.10. Autorizar a IMOBILIÁRIA a representá-lo perante terceiros e órgãos públicos.

────────────────────────────────────────────────────
VII – DAS OBRIGAÇÕES DO LOCATÁRIO

O LOCATÁRIO obriga-se a:

7.1. Pagar pontualmente o aluguel e encargos da locação no prazo estipulado.

7.2. Utilizar o imóvel exclusivamente para fins residenciais.

7.3. Restituir o imóvel, ao final da locação, no estado em que o recebeu, salvo deteriorações decorrentes do uso normal.

7.4. Comunicar imediatamente ao LOCADOR e à IMOBILIÁRIA qualquer dano ou defeito cuja reparação caiba a eles.

7.5. Realizar às suas expensas os reparos de manutenção e pequenos consertos.

7.6. Não modificar a forma externa ou interna do imóvel sem o consentimento prévio e por escrito do LOCADOR.

7.7. Não sublocar, emprestar, ceder ou transferir a locação sem autorização prévia.

7.8. Permitir a vistoria do imóvel mediante agendamento prévio.

7.9. Cumprir as normas do condomínio (se houver).

7.10. Manter em dia as contas de consumo de água, luz, gás e outras de sua responsabilidade.

7.11. Comunicar imediatamente qualquer sinistro ocorrido no imóvel.

7.12. Não manter animais que causem incômodo à vizinhança ou estejam proibidos pelo condomínio.

7.13. Zelar pela boa conservação do imóvel, suas instalações e áreas comuns.

7.14. Entregar as chaves à IMOBILIÁRIA ao término da locação.

────────────────────────────────────────────────────
VIII – DAS OBRIGAÇÕES DA IMOBILIÁRIA

A IMOBILIÁRIA obriga-se a:

8.1. Administrar o imóvel com diligência e boa-fé.

8.2. Cobrar os aluguéis e encargos em nome do LOCADOR.

8.3. Repassar ao LOCADOR os valores recebidos, deduzida a taxa de administração, em até [PRAZO_REPASSE_LOCADOR] dias úteis após o recebimento.

8.4. Disponibilizar ao LOCADOR relatórios mensais de gestão via plataforma online.

8.5. Realizar as vistorias inicial, periódicas e final do imóvel.

8.6. Notificar o LOCATÁRIO sobre débitos e inadimplência.

8.7. Tomar as medidas extrajudiciais e judiciais cabíveis em caso de inadimplência, mediante autorização do LOCADOR.

8.8. Representar o LOCADOR junto às concessionárias e órgãos públicos, quando necessário.

8.9. Manter sigilo sobre informações das partes, observando a LGPD.

8.10. Comunicar ao LOCADOR qualquer irregularidade verificada no imóvel.

8.11. Providenciar os reparos de urgência, comunicando imediatamente o LOCADOR.

8.12. Mediar conflitos entre LOCADOR e LOCATÁRIO.

────────────────────────────────────────────────────
IX – DAS PENALIDADES

§1º INFRAÇÃO CONTRATUAL:
A parte que infringir qualquer cláusula deste contrato pagará à outra:
• Multa de [MULTA_INFRACAO_PERCENTUAL]% sobre o valor de [MULTA_INFRACAO_MESES] meses de aluguel vigente
• Indenização por perdas e danos comprovados
• Honorários advocatícios de [HONORARIOS_PERCENTUAL]%

§2º DESCUMPRIMENTO PELO LOCATÁRIO:
Além da multa acima, o LOCATÁRIO inadimplente estará sujeito a:
• Rescisão contratual imediata
• Ação de despejo
• Cobrança judicial dos valores devidos
• Negativação nos órgãos de proteção ao crédito

§3º DESCUMPRIMENTO PELO LOCADOR:
O descumprimento pelo LOCADOR de suas obrigações autoriza o LOCATÁRIO a:
• Exigir o cumprimento
• Rescindir o contrato
• Pleitear indenização por danos

────────────────────────────────────────────────────
X – DO PRAZO E VIGÊNCIA

§1º PRAZO DA LOCAÇÃO:
O presente contrato é firmado pelo prazo de [PRAZO_LOCACAO_MESES] meses, com início em [DATA_INICIO_CONTRATO] e término em [DATA_FIM_CONTRATO].

§2º PRORROGAÇÃO:
Findo o prazo contratual, se o LOCATÁRIO permanecer no imóvel por mais de 30 (trinta) dias sem oposição do LOCADOR, a locação será prorrogada por prazo indeterminado, mantidas as demais condições contratuais.

§3º DENÚNCIA NA PRORROGAÇÃO:
Na vigência por prazo indeterminado:
• O LOCADOR poderá denunciar a locação, concedendo prazo de 30 dias para desocupação
• O LOCATÁRIO poderá denunciar a qualquer tempo, mediante aviso prévio de 30 dias

§4º ENTREGA DAS CHAVES:
As chaves serão entregues ao LOCATÁRIO após:
• Assinatura deste contrato
• Comprovação da garantia locatícia
• Realização da vistoria inicial
• Pagamento do primeiro aluguel (se aplicável)

────────────────────────────────────────────────────
XI – DA RESCISÃO CONTRATUAL

§1º RESCISÃO PELO LOCATÁRIO:
O LOCATÁRIO poderá rescindir este contrato:

a) Durante o prazo determinado:
• Pagando multa proporcional ao período restante
• Cálculo: (meses restantes / prazo total) x valor da multa integral
• Valor da multa integral: [MULTA_RESCISAO_MESES] meses de aluguel

b) Após 12 meses de vigência:
• Isento de multa, mediante aviso prévio de 30 dias
• Conforme art. 4º, parágrafo único da Lei 8.245/91

c) Por transferência de emprego:
• Isento de multa, mediante comprovação
• Aviso prévio de 30 dias

§2º RESCISÃO PELO LOCADOR:
O LOCADOR poderá rescindir o contrato:
• Por falta de pagamento de aluguel e encargos
• Por infração contratual ou legal
• Nas demais hipóteses previstas na Lei 8.245/91

§3º PROCEDIMENTO DE DEVOLUÇÃO:
Para a devolução do imóvel:
1. Comunicar a IMOBILIÁRIA com antecedência mínima de 30 dias
2. Agendar vistoria final
3. Quitar todos os débitos pendentes
4. Entregar o imóvel nas condições da vistoria inicial
5. Entregar as chaves à IMOBILIÁRIA

────────────────────────────────────────────────────
XII – DA PROTEÇÃO DE DADOS (LGPD)

§1º CONSENTIMENTO:
As partes CONSENTEM expressamente com a coleta, armazenamento e tratamento de seus dados pessoais pela IMOBILIÁRIA, nos termos da Lei 13.709/2018 (LGPD).

§2º FINALIDADE DO TRATAMENTO:
Os dados pessoais serão utilizados exclusivamente para:
• Execução do presente contrato
• Emissão de documentos contratuais
• Geração de laudos e vistorias
• Cobranças e pagamentos
• Comunicações relativas à locação
• Cumprimento de obrigações legais
• Integração com APIs bancárias e gateways de pagamento
• Relatórios gerenciais

§3º COMPARTILHAMENTO:
Os dados poderão ser compartilhados com:
• Órgãos públicos (mediante requisição legal)
• Instituições financeiras (para processamento de pagamentos)
• Prestadores de serviços (vistorias, reparos)
• Órgãos de proteção ao crédito (em caso de inadimplência)

§4º DIREITOS DOS TITULARES:
As partes podem, a qualquer momento:
• Solicitar acesso aos seus dados
• Corrigir dados incompletos ou desatualizados
• Solicitar portabilidade dos dados
• Revogar o consentimento (quando aplicável)

§5º SEGURANÇA:
A IMOBILIÁRIA compromete-se a adotar medidas técnicas e administrativas para proteger os dados contra acessos não autorizados e situações de destruição, perda ou alteração.

────────────────────────────────────────────────────
XIII – DOS DOCUMENTOS ANEXOS

Fazem parte integrante deste contrato, independentemente de transcrição:

• Laudo de Vistoria Inicial: [ANEXO_VISTORIA_INICIAL]
• Laudo de Vistoria Final (quando aplicável): [ANEXO_VISTORIA_FINAL]
• Documentos Pessoais do Locador: [ANEXO_DOCS_LOCADOR]
• Documentos Pessoais do Locatário: [ANEXO_DOCS_LOCATARIO]
• Documentos do Imóvel: [ANEXO_DOCS_IMOVEL]
• Comprovantes de Garantia: [ANEXO_GARANTIA]
• Convenção do Condomínio (se aplicável): [ANEXO_CONVENCAO_CONDOMINIO]

────────────────────────────────────────────────────
XIV – DO FORO

Fica eleito o foro da comarca de [FORO_CIDADE]/[FORO_ESTADO] para dirimir quaisquer litígios oriundos deste contrato, renunciando as partes a qualquer outro, por mais privilegiado que seja.

────────────────────────────────────────────────────
XV – DA ASSINATURA DIGITAL E VALIDADE JURÍDICA

As partes reconhecem a validade jurídica das assinaturas eletrônicas apostas neste instrumento, nos termos da Medida Provisória 2.200-2/2001 e da Lei 14.063/2020.

Este documento foi assinado digitalmente através da plataforma MR3X, garantindo:
• Autenticidade da identidade dos signatários
• Integridade do conteúdo
• Não repúdio das assinaturas
• Registro de data e hora (timestamp)
• Geolocalização e IP de cada signatário

HASH DO DOCUMENTO: [HASH_DOCUMENTO]

REGISTRO DE ASSINATURAS:

IPs de Registro:
• Imobiliária: [IP_IMOBILIARIA]
• Locador: [IP_LOCADOR]
• Locatário: [IP_LOCATARIO]

Geolocalização:
• Imobiliária: [GEO_IMOBILIARIA]
• Locador: [GEO_LOCADOR]
• Locatário: [GEO_LOCATARIO]

ASSINAM DIGITALMENTE:

LOCADOR:
Nome: [LOCADOR_NOME]
CPF: [LOCADOR_CPF]
Data: [DATA_ASS_LOCADOR]
Hora: [HORA_ASS_LOCADOR]


LOCATÁRIO:
Nome: [LOCATARIO_NOME]
CPF: [LOCATARIO_CPF]
Data: [DATA_ASS_LOCATARIO]
Hora: [HORA_ASS_LOCATARIO]


CÔNJUGE DO LOCATÁRIO (se aplicável):
Nome: [CONJUGE_LOCATARIO_NOME]
CPF: [CONJUGE_LOCATARIO_CPF]
Data: [DATA_ASS_CONJUGE_LOCATARIO]
Hora: [HORA_ASS_CONJUGE_LOCATARIO]


IMOBILIÁRIA:
Razão Social: [IMOBILIARIA_RAZAO_SOCIAL]
CNPJ: [IMOBILIARIA_CNPJ]
Representante: [IMOBILIARIA_REPRESENTANTE]
Data: [DATA_ASS_IMOBILIARIA]
Hora: [HORA_ASS_IMOBILIARIA]


TESTEMUNHAS (se aplicável):

1ª Testemunha:
Nome: [TESTEMUNHA1_NOME]
CPF: [TESTEMUNHA1_CPF]
Data: [DATA_ASS_TESTEMUNHA1]

2ª Testemunha:
Nome: [TESTEMUNHA2_NOME]
CPF: [TESTEMUNHA2_CPF]
Data: [DATA_ASS_TESTEMUNHA2]

════════════════════════════════════════════════════════════════════════════════
                           FIM DO CONTRATO
════════════════════════════════════════════════════════════════════════════════`
};

const contratoLocacaoRuralLocadoresPfLocatarioPj: ContractTemplate = {
  id: "contrato-locacao-rural-locadores-pf-locatario-pj",
  name: "Locação de Imóvel Rural - Locadores PF / Locatário PJ",
  description: "Contrato de locação de imóvel rural entre múltiplos Locadores Pessoa Física e Locatário Pessoa Jurídica",
  type: "CTR",
  allowedUserTypes: ['INDEPENDENT_OWNER'],
  propertyType: 'RURAL',
  landlordType: 'PF',
  tenantType: 'PJ',
  category: 'RENTAL',
  content: `
════════════════════════════════════════════════════════════════════════════════
                    CONTRATO DE LOCAÇÃO DE IMÓVEL RURAL
                      LOCADORES (PF) / LOCATÁRIO (PJ)
════════════════════════════════════════════════════════════════════════════════

────────────────────────────────────────────────────
IDENTIFICAÇÃO DAS PARTES
────────────────────────────────────────────────────

LOCADORES / PROPRIETÁRIOS:

LOCADOR 1:
• Nome Completo: [LOCADOR1_NOME]
• Nacionalidade: [LOCADOR1_NACIONALIDADE]
• Estado Civil: [LOCADOR1_ESTADO_CIVIL]
• Profissão: [LOCADOR1_PROFISSAO]
• RG: [LOCADOR1_RG]
• CPF: [LOCADOR1_CPF]
• Endereço Completo: [LOCADOR1_ENDERECO]

LOCADOR 2:
• Nome Completo: [LOCADOR2_NOME]
• Nacionalidade: [LOCADOR2_NACIONALIDADE]
• Estado Civil: [LOCADOR2_ESTADO_CIVIL]
• Profissão: [LOCADOR2_PROFISSAO]
• RG: [LOCADOR2_RG]
• CPF: [LOCADOR2_CPF]
• Endereço Completo: [LOCADOR2_ENDERECO]

(Inserir mais locadores se necessário)


LOCATÁRIO – PESSOA JURÍDICA:
• Razão Social: [LOCATARIO_RAZAO_SOCIAL]
• CNPJ: [LOCATARIO_CNPJ]
• Endereço Completo: [LOCATARIO_ENDERECO]

REPRESENTANTE LEGAL:
• Nome: [LOCATARIO_REP_NOME]
• Nacionalidade: [LOCATARIO_REP_NACIONALIDADE]
• Estado Civil: [LOCATARIO_REP_ESTADO_CIVIL]
• CPF: [LOCATARIO_REP_CPF]
• RG: [LOCATARIO_REP_RG]
• Endereço: [LOCATARIO_REP_ENDERECO]

────────────────────────────────────────────────────
IMÓVEL OBJETO DA LOCAÇÃO

• Tipo: Imóvel Rural
• Localização: [IMOVEL_LOCALIDADE]
• Área Total Locada: [IMOVEL_AREA_LOCADA] m²
• Área Total da Propriedade: [IMOVEL_AREA_TOTAL] m²
• Matrícula / Registro: [IMOVEL_MATRICULA]
• Comarca: [IMOVEL_COMARCA]
• Descrição complementar: [IMOVEL_DESCRICAO]

────────────────────────────────────────────────────
I – DO OBJETO

O presente contrato tem por objeto a locação do imóvel rural acima descrito, pelos LOCADORES ao LOCATÁRIO, para os fins autorizados neste instrumento.

A locação é regida pela Lei nº 4.504/1964 (Estatuto da Terra), pelo Decreto nº 59.566/1966 e, subsidiariamente, pelo Código Civil Brasileiro.

────────────────────────────────────────────────────
II – DO PRAZO

§1º VIGÊNCIA:
• Prazo: [PRAZO_MESES] meses
• Data de Início: [DATA_INICIO]
• Data de Término: [DATA_FIM]

§2º PRORROGAÇÃO AUTOMÁTICA:
Se, após o término, o LOCATÁRIO permanecer no imóvel por mais de 30 (trinta) dias sem oposição expressa dos LOCADORES, o contrato será prorrogado por prazo indeterminado, mantendo-se todas as condições pactuadas.

§3º DEVOLUÇÃO ANTECIPADA:
O imóvel poderá ser devolvido pelo LOCATÁRIO a qualquer tempo, mediante aviso prévio de [DIAS_AVISO_PREVIO] dias.

Caso descumpra o aviso prévio, o LOCATÁRIO pagará multa equivalente a [MULTA_RESTITUICAO_MESES] meses de aluguel.

────────────────────────────────────────────────────
III – DA FINALIDADE DA LOCAÇÃO

O imóvel será utilizado exclusivamente para:
[FINALIDADE_USO]

É vedado ao LOCATÁRIO qualquer uso diverso da finalidade acima especificada sem autorização expressa e por escrito dos LOCADORES.

O LOCATÁRIO se compromete a observar todas as normas ambientais, agrícolas e municipais aplicáveis à atividade desenvolvida no imóvel.

────────────────────────────────────────────────────
IV – DO VALOR E FORMA DE PAGAMENTO

§1º VALOR DO ALUGUEL:
O valor mensal do aluguel é de R$ [VALOR_ALUGUEL] ([VALOR_ALUGUEL_EXTENSO]).

§2º VENCIMENTO:
O pagamento deverá ser efetuado até o dia [DIA_VENCIMENTO] de cada mês.

§3º FORMA DE PAGAMENTO:
O pagamento será realizado diretamente aos LOCADORES ou por meio de depósito/transferência bancária:

• Banco: [BANCO]
• Agência: [AGENCIA]
• Conta: [CONTA]
• Chave PIX: [CHAVE_PIX]

§4º REAJUSTE:
O valor do aluguel será reajustado anualmente pelo índice [INDICE_REAJUSTE], ou outro índice que vier a substituí-lo, na data de aniversário do contrato.

────────────────────────────────────────────────────
V – DA MULTA POR ATRASO

Em caso de atraso no pagamento do aluguel, incidirão:

• Multa de [MULTA_ATRASO]% sobre o valor devido
• Juros de mora de [JUROS_ATRASO]% ao mês
• Correção monetária pelo índice [INDICE_CORRECAO]

O não pagamento de 2 (dois) ou mais aluguéis consecutivos autoriza os LOCADORES a promoverem a rescisão contratual e a retomada do imóvel.

────────────────────────────────────────────────────
VI – DA CESSÃO, SUBLOCAÇÃO E EMPRÉSTIMO

É expressamente proibido ao LOCATÁRIO, sem autorização prévia e por escrito dos LOCADORES:

• Ceder os direitos deste contrato a terceiros
• Emprestar o imóvel, total ou parcialmente
• Sublocar o imóvel ou qualquer parte dele
• Transferir este contrato a qualquer título

A violação desta cláusula acarretará a rescisão imediata do contrato e a aplicação das penalidades previstas.

────────────────────────────────────────────────────
VII – DA RESCISÃO AUTOMÁTICA

O contrato será rescindido automaticamente, sem direito a qualquer indenização, nas seguintes hipóteses:

a) Desapropriação total ou parcial do imóvel por utilidade pública ou interesse social;

b) Impossibilidade do LOCATÁRIO utilizar o imóvel para a finalidade acordada, por motivo de força maior;

c) Uso irregular ou diverso da finalidade estabelecida na Cláusula III;

d) Descumprimento de obrigações essenciais previstas neste contrato;

e) Abandono do imóvel por prazo superior a [DIAS_ABANDONO] dias consecutivos;

f) Prática de atos que causem danos ambientais ou degradação do solo.

────────────────────────────────────────────────────
VIII – DA ALIENAÇÃO DO IMÓVEL

Se o imóvel for vendido ou alienado durante a vigência do contrato:

§1º O adquirente deverá respeitar o contrato até o fim do prazo, mantendo todas as condições pactuadas, desde que o contrato esteja registrado em Cartório de Registro de Imóveis ou contenha cláusula de vigência.

§2º Os LOCADORES se comprometem a notificar o LOCATÁRIO, com antecedência mínima de 30 (trinta) dias, sobre a intenção de alienar o imóvel.

§3º O LOCATÁRIO terá direito de preferência na aquisição do imóvel, em igualdade de condições com terceiros, conforme legislação vigente.

────────────────────────────────────────────────────
IX – DA INFRAÇÃO CONTRATUAL

A parte que infringir qualquer cláusula deste contrato pagará multa equivalente a:

[MULTA_INFRACAO_MESES] meses de aluguel vigente

Além da multa, a parte infratora será responsável por:
• Perdas e danos comprovados
• Honorários advocatícios de [HONORARIOS_PERCENTUAL]%
• Custas processuais

────────────────────────────────────────────────────
X – DAS RESPONSABILIDADES DAS PARTES

§1º OBRIGAÇÕES DOS LOCADORES:
Os LOCADORES obrigam-se a:

a) Garantir a posse pacífica do imóvel durante toda a vigência do contrato;

b) Entregar o imóvel em condições de uso para a finalidade acordada;

c) Assegurar a regularidade da titularidade da propriedade;

d) Cumprir as obrigações fiscais e legais de sua responsabilidade, incluindo ITR;

e) Manter atualizadas as documentações do imóvel (matrícula, CAR, CCIR);

f) Não interferir nas atividades do LOCATÁRIO, desde que compatíveis com o contrato;

g) Responder pelos vícios ou defeitos anteriores à locação.

§2º OBRIGAÇÕES DO LOCATÁRIO:
O LOCATÁRIO obriga-se a:

a) Usar o imóvel exclusivamente para o fim previsto neste contrato;

b) Conservar o imóvel, realizando manutenções necessárias de sua responsabilidade;

c) Comunicar imediatamente aos LOCADORES qualquer dano ou irregularidade;

d) Não causar prejuízos ambientais, estruturais ou de qualquer natureza ao imóvel;

e) Cumprir rigorosamente as normas ambientais, agrícolas e municipais aplicáveis;

f) Permitir o acesso dos LOCADORES para vistorias, mediante aviso prévio de 48 horas;

g) Pagar pontualmente o aluguel e encargos de sua responsabilidade;

h) Devolver o imóvel nas mesmas condições em que recebeu, salvo desgaste natural;

i) Manter seguro rural, quando aplicável à atividade desenvolvida.

────────────────────────────────────────────────────
XI – DA DEVOLUÇÃO DO IMÓVEL

Ao término da locação, o LOCATÁRIO deverá devolver o imóvel:

§1º Nas mesmas condições em que o recebeu, conforme vistoria inicial, ressalvado o desgaste natural decorrente do uso regular;

§2º Após realização de vistoria final, a ser agendada na data: [DATA_VISTORIA_FINAL];

§3º Com laudo digital de vistoria: [ANEXO_VISTORIA_FINAL]

§4º DANOS E REPAROS:
Caso sejam constatados danos além do desgaste natural, o LOCATÁRIO arcará com:
• Reparos necessários para recomposição do imóvel
• Indenizações por perdas e danos
• Custos relacionados à recomposição ambiental, se aplicável

§5º BENFEITORIAS:
• Benfeitorias necessárias serão indenizadas, ainda que não autorizadas
• Benfeitorias úteis serão indenizadas se autorizadas previamente por escrito
• Benfeitorias voluptuárias não serão indenizadas e poderão ser levantadas pelo LOCATÁRIO

────────────────────────────────────────────────────
XII – DO FORO

Fica eleito o foro da comarca de [FORO_CIDADE_ESTADO] para dirimir quaisquer litígios oriundos deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

────────────────────────────────────────────────────
XIII – DA ASSINATURA DIGITAL E VALIDADE JURÍDICA

As partes reconhecem a validade jurídica das assinaturas eletrônicas apostas neste instrumento, nos termos da Medida Provisória 2.200-2/2001 e da Lei 14.063/2020.

Este documento foi assinado digitalmente, garantindo:
• Autenticidade da identidade dos signatários
• Integridade do conteúdo
• Não repúdio das assinaturas
• Registro de data e hora (timestamp)

HASH DO DOCUMENTO: [HASH_DOCUMENTO]

REGISTRO DE IPs:
• Locadores: [IP_LOCADORES]
• Locatário: [IP_LOCATARIO]


ASSINAM DIGITALMENTE:


LOCADOR 1:
Nome: [LOCADOR1_NOME]
CPF: [LOCADOR1_CPF]
Data: [DATA_ASS_LOCADOR1]


LOCADOR 2:
Nome: [LOCADOR2_NOME]
CPF: [LOCADOR2_CPF]
Data: [DATA_ASS_LOCADOR2]


LOCATÁRIO (PESSOA JURÍDICA):
Razão Social: [LOCATARIO_RAZAO_SOCIAL]
CNPJ: [LOCATARIO_CNPJ]
Representante: [LOCATARIO_REP_NOME]
Data: [DATA_ASS_LOCATARIO]

════════════════════════════════════════════════════════════════════════════════
                           FIM DO CONTRATO
════════════════════════════════════════════════════════════════════════════════`
};

const contratoLocacaoResidencial: ContractTemplate = {
  id: "contrato-locacao-residencial-padrao",
  name: "Locação Residencial - Locador PF / Locatário PF",
  description: "Contrato de locação residencial padrão entre Locador Pessoa Física e Locatário Pessoa Física, com opção de fiador",
  type: "CTR",
  allowedUserTypes: ['INDEPENDENT_OWNER'],
  propertyType: 'RESIDENTIAL',
  landlordType: 'PF',
  tenantType: 'PF',
  category: 'RENTAL',
  content: `
════════════════════════════════════════════════════════════════════════════════
                    CONTRATO DE LOCAÇÃO RESIDENCIAL
                      LOCADOR (PF) / LOCATÁRIO (PF)
════════════════════════════════════════════════════════════════════════════════

────────────────────────────────────────────────────
IDENTIFICAÇÃO DAS PARTES
────────────────────────────────────────────────────

LOCADOR:
• Nome Completo: [LOCADOR_NOME]
• Nacionalidade: [LOCADOR_NACIONALIDADE]
• Estado Civil: [LOCADOR_ESTADO_CIVIL]
• Profissão: [LOCADOR_PROFISSAO]
• CPF: [LOCADOR_CPF]
• RG: [LOCADOR_RG]
• Endereço Completo: [LOCADOR_ENDERECO]
• Telefone: [LOCADOR_TELEFONE]
• E-mail: [LOCADOR_EMAIL]


LOCATÁRIO:
• Nome Completo: [LOCATARIO_NOME]
• Nacionalidade: [LOCATARIO_NACIONALIDADE]
• Estado Civil: [LOCATARIO_ESTADO_CIVIL]
• Profissão: [LOCATARIO_PROFISSAO]
• CPF: [LOCATARIO_CPF]
• RG: [LOCATARIO_RG]
• Data de Nascimento: [LOCATARIO_DATA_NASC]
• Endereço Atual: [LOCATARIO_ENDERECO]
• Telefone: [LOCATARIO_TELEFONE]
• E-mail: [LOCATARIO_EMAIL]


FIADOR(ES) - SE HOUVER:
• Nome Completo: [FIADOR_NOME]
• CPF: [FIADOR_CPF]
• RG: [FIADOR_RG]
• Endereço: [FIADOR_ENDERECO]
• Profissão: [FIADOR_PROFISSAO]
• Responsabilidade Solidária: [FIADOR_RESP_SOLIDARIA]

────────────────────────────────────────────────────
IMÓVEL OBJETO DA LOCAÇÃO

• Endereço Completo: [IMOVEL_ENDERECO]
• Descrição: [IMOVEL_DESCRICAO]
• Matrícula / Registro: [IMOVEL_MATRICULA]
• Área: [IMOVEL_AREA]
• Mobílias / Itens incluídos: [IMOVEL_MOVEIS]

────────────────────────────────────────────────────
I – DA FINALIDADE

O imóvel será utilizado exclusivamente para fins RESIDENCIAIS, sendo expressamente proibido:

• Uso comercial de qualquer natureza
• Sublocação total ou parcial
• Hospedagem remunerada (Airbnb, booking, etc.)
• Cessão a terceiros não autorizados
• Instalação de pensão, república ou similares

Finalidade especial (se aplicável): [FINALIDADE_ESPECIAL]

O descumprimento desta cláusula autoriza a rescisão imediata do contrato.

────────────────────────────────────────────────────
II – DO PRAZO DA LOCAÇÃO

§1º VIGÊNCIA:
• Prazo total: [PRAZO_MESES] meses
• Data de Início: [DATA_INICIO]
• Data de Término: [DATA_FIM]

§2º PRORROGAÇÃO:
Após o término do prazo contratual, caso o LOCATÁRIO permaneça no imóvel por mais de 30 (trinta) dias sem oposição expressa do LOCADOR, a locação será prorrogada por prazo indeterminado, mantidas as demais condições contratuais.

§3º DENÚNCIA:
Na vigência por prazo indeterminado, qualquer das partes poderá denunciar o contrato mediante aviso prévio de 30 (trinta) dias.

────────────────────────────────────────────────────
III – DOS VALORES E PAGAMENTOS

§1º ALUGUEL MENSAL:
• Valor: R$ [VALOR_ALUGUEL] ([VALOR_ALUGUEL_EXTENSO])
• Vencimento: dia [DIA_VENCIMENTO] de cada mês

§2º ENCARGOS DO LOCATÁRIO:
• Água: [AGUA_RESPONSAVEL]
• Energia Elétrica: [ENERGIA_RESPONSAVEL]
• Gás: [GAS_RESPONSAVEL]
• Condomínio: [CONDOMINIO_RESPONSAVEL]
• IPTU: [IPTU_RESPONSAVEL]
• Seguro Incêndio Obrigatório: R$ [SEGURO_INCENDIO_VALOR]

§3º LOCAL E FORMA DE PAGAMENTO:
O pagamento será realizado:
• Forma: [FORMA_PAGAMENTO]
• Por meio de administradora: [USO_IMOBILIARIA]
• Dados bancários / PIX: [DADOS_BANCARIOS]

────────────────────────────────────────────────────
IV – DO REAJUSTE DO ALUGUEL

O valor do aluguel será reajustado anualmente, na data de aniversário do contrato, pelo índice [INDICE_REAJUSTE], ou por outro índice que vier a substituí-lo.

Na falta de índice oficial, as partes acordarão novo valor, observados os parâmetros de mercado.

────────────────────────────────────────────────────
V – DA GARANTIA LOCATÍCIA

§1º MODALIDADE:
A garantia locatícia é prestada na modalidade: [TIPO_GARANTIA]

§2º VALOR:
O valor da garantia é de R$ [VALOR_GARANTIA] ([VALOR_GARANTIA_EXTENSO])

§3º DADOS COMPLEMENTARES:
[GARANTIA_DADOS]

§4º DISPOSIÇÕES:
a) No caso de FIANÇA, o(s) fiador(es) se obriga(m) solidariamente pelo cumprimento de todas as obrigações do LOCATÁRIO, renunciando expressamente ao benefício de ordem previsto no art. 827 do Código Civil.

b) No caso de CAUÇÃO, o valor será depositado em conta poupança e devolvido ao LOCATÁRIO ao final da locação, com correção, após quitação de todas as obrigações.

c) No caso de SEGURO-FIANÇA ou TÍTULO DE CAPITALIZAÇÃO, o LOCATÁRIO é responsável pela manutenção da garantia durante toda a vigência contratual.

────────────────────────────────────────────────────
VI – DAS VISTORIAS

§1º VISTORIA INICIAL:
• Data: [DATA_VISTORIA_INICIAL]
• Laudo: [ANEXO_VISTORIA_INICIAL]

§2º VISTORIA FINAL:
• Data: [DATA_VISTORIA_FINAL]
• Laudo: [ANEXO_VISTORIA_FINAL]

§3º CONDIÇÕES DE DEVOLUÇÃO:
O LOCATÁRIO devolverá o imóvel nas mesmas condições em que recebeu, conforme laudo de vistoria inicial, ressalvado o desgaste natural decorrente do uso regular.

§4º DISCORDÂNCIA:
Em caso de discordância quanto ao laudo de vistoria, as partes poderão indicar perito para arbitrar a questão.

────────────────────────────────────────────────────
VII – DAS OBRIGAÇÕES DO LOCADOR

O LOCADOR obriga-se a:

7.1. Entregar o imóvel em perfeitas condições de habitabilidade e uso;

7.2. Garantir ao LOCATÁRIO a posse pacífica do imóvel durante toda a vigência do contrato;

7.3. Manter em dia os tributos e encargos de sua responsabilidade;

7.4. Realizar os reparos estruturais necessários, que não decorram de mau uso pelo LOCATÁRIO;

7.5. Fornecer recibos de pagamento quando solicitado;

7.6. Informar ao LOCATÁRIO qualquer alteração em seus dados cadastrais;

7.7. Responder pelos vícios ou defeitos anteriores à locação;

7.8. Fornecer documentação necessária para transferência de contas de concessionárias.

────────────────────────────────────────────────────
VIII – DAS OBRIGAÇÕES DO LOCATÁRIO

O LOCATÁRIO obriga-se a:

8.1. Utilizar o imóvel exclusivamente para moradia própria e de sua família;

8.2. Conservar o imóvel, mantendo-o em bom estado;

8.3. Comunicar imediatamente ao LOCADOR qualquer dano ou defeito;

8.4. Permitir vistorias no imóvel mediante aviso prévio de 48 horas;

8.5. Pagar pontualmente o aluguel e encargos nas datas estipuladas;

8.6. Não realizar reformas ou alterações sem prévia autorização por escrito do LOCADOR;

8.7. Manter o imóvel limpo e em bom estado de conservação;

8.8. Devolver o imóvel nas condições constantes da vistoria inicial;

8.9. Cumprir as normas do condomínio (se aplicável);

8.10. Comunicar mudança de dados cadastrais;

8.11. Não modificar instalações elétricas, hidráulicas ou de gás sem autorização.

────────────────────────────────────────────────────
IX – DOS DANOS E AVARIAS

O LOCATÁRIO será responsável pelo pagamento de:

• Reparos decorrentes de mau uso ou negligência
• Reposição de itens danificados ou extraviados
• Danos ao imóvel causados por ele ou terceiros sob sua responsabilidade
• Prejuízos causados por mau uso das instalações

Os itens danificados serão identificados e cobrados conforme laudo de vistoria final, com valores de mercado atualizados.

────────────────────────────────────────────────────
X – DAS MULTAS, ATRASOS E PENALIDADES

§1º ATRASO NO PAGAMENTO:
Em caso de atraso no pagamento do aluguel e/ou encargos, incidirão:
• Multa de [MULTA_ATRASO]% sobre o valor devido
• Juros de [JUROS_ATRASO]% ao mês
• Correção monetária pelo índice [INDICE_CORRECAO]

§2º MULTA RESCISÓRIA:
Em caso de rescisão antecipada pelo LOCATÁRIO durante o prazo determinado:
• Multa de [MULTA_RESCISAO_MESES] meses de aluguel, proporcional ao tempo restante
• Conforme art. 4º da Lei 8.245/91, após 12 meses de locação, não haverá multa se houver transferência de emprego

§3º INFRAÇÃO CONTRATUAL:
A parte que infringir qualquer cláusula deste contrato pagará multa equivalente a [MULTA_INFRACAO_MESES] meses de aluguel, sem prejuízo das demais cominações legais.

────────────────────────────────────────────────────
XI – DA RESCISÃO

A rescisão do contrato poderá ocorrer:

a) Por descumprimento de cláusula contratual por qualquer das partes;

b) Por inadimplência do LOCATÁRIO;

c) Por mau uso do imóvel;

d) Por interesse de qualquer das partes, mediante aviso prévio de [DIAS_AVISO_PREVIO] dias;

e) Nas demais hipóteses previstas na Lei 8.245/91 (Lei do Inquilinato).

§ ÚNICO: O imóvel será devolvido somente após realização da vistoria final e quitação de todos os débitos pendentes.

────────────────────────────────────────────────────
XII – DAS PROIBIÇÕES

É expressamente proibido ao LOCATÁRIO:

• Sublocar o imóvel, total ou parcialmente
• Ceder ou transferir o contrato sem autorização
• Alterar a estrutura do imóvel
• Realizar atividades comerciais
• Criar animais proibidos por lei ou regulamento do condomínio
• Instalar equipamentos de gás sem autorização e projeto aprovado
• Realizar obras que comprometam a estrutura do imóvel
• Dar destinação diversa da finalidade residencial
• Causar incômodos à vizinhança

────────────────────────────────────────────────────
XIII – DA PROTEÇÃO DE DADOS (LGPD)

Os dados pessoais fornecidos pelas partes serão utilizados exclusivamente para:

• Gestão e execução do presente contrato
• Cobranças e notificações
• Emissão de recibos e documentos
• Segurança e registros legais
• Relatórios internos de gestão

O tratamento dos dados observará a Lei 13.709/2018 (Lei Geral de Proteção de Dados).

As partes poderão, a qualquer momento, solicitar informações sobre o tratamento de seus dados ou requerer sua exclusão, observadas as obrigações legais de guarda.

────────────────────────────────────────────────────
XIV – DO FORO

Fica eleito o foro da comarca de [FORO_CIDADE_ESTADO] para dirimir quaisquer litígios oriundos deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

────────────────────────────────────────────────────
XV – DA ASSINATURA DIGITAL E VALIDADE JURÍDICA

As partes reconhecem a validade jurídica das assinaturas eletrônicas apostas neste instrumento, nos termos da Medida Provisória 2.200-2/2001 e da Lei 14.063/2020.

Este documento foi assinado digitalmente, garantindo:
• Autenticidade da identidade dos signatários
• Integridade do conteúdo
• Não repúdio das assinaturas
• Registro de data e hora (timestamp)

HASH DO DOCUMENTO: [HASH_DOCUMENTO]

REGISTRO DE IPs:
• Locador: [IP_LOCADOR]
• Locatário: [IP_LOCATARIO]
• Fiador (se houver): [IP_FIADOR]

────────────────────────────────────────────────────

ASSINAM DIGITALMENTE:

LOCADOR:
Nome: [LOCADOR_NOME]
CPF: [LOCADOR_CPF]
Data: [DATA_ASS_LOCADOR]


LOCATÁRIO:
Nome: [LOCATARIO_NOME]
CPF: [LOCATARIO_CPF]
Data: [DATA_ASS_LOCATARIO]


FIADOR (SE HOUVER):
Nome: [FIADOR_NOME]
CPF: [FIADOR_CPF]
Data: [DATA_ASS_FIADOR]

════════════════════════════════════════════════════════════════════════════════
                           FIM DO CONTRATO
════════════════════════════════════════════════════════════════════════════════`
};

const contratoLocacaoComercialProprietarioPJ: ContractTemplate = {
  id: "contrato-locacao-comercial-proprietario-pj",
  name: "Locação Comercial - Proprietário Independente / Locatário PJ",
  description: "Contrato de locação de imóvel comercial entre proprietário independente e empresa (Pessoa Jurídica)",
  type: "CTR",
  allowedUserTypes: ['INDEPENDENT_OWNER'],
  propertyType: 'COMMERCIAL',
  landlordType: 'PF',
  tenantType: 'PJ',
  category: 'RENTAL',
  content: `
════════════════════════════════════════════════════════════════════════════════
                    CONTRATO DE LOCAÇÃO COMERCIAL
              PROPRIETÁRIO INDEPENDENTE x INQUILINO (PESSOA JURÍDICA)
════════════════════════════════════════════════════════════════════════════════

Contrato completo para locação de imóvel comercial entre proprietário e empresa.

────────────────────────────────────────────────────
1. DAS PARTES

PROPRIETÁRIO (LOCADOR):
• Nome Completo: [LOCADOR_NOME]
• Documento (CPF): [LOCADOR_CPF]
• RG: [LOCADOR_RG]
• Nacionalidade: [LOCADOR_NACIONALIDADE]
• Estado Civil: [LOCADOR_ESTADO_CIVIL]
• Profissão: [LOCADOR_PROFISSAO]
• Endereço: [LOCADOR_ENDERECO]
• E-mail: [LOCADOR_EMAIL]
• Telefone: [LOCADOR_TELEFONE]


LOCATÁRIA (PESSOA JURÍDICA):
• Razão Social: [LOCATARIO_RAZAO_SOCIAL]
• CNPJ: [LOCATARIO_CNPJ]
• Inscrição Estadual: [LOCATARIO_IE]
• Inscrição Municipal: [LOCATARIO_IM]
• Endereço da Sede: [LOCATARIO_ENDERECO]
• Telefone: [LOCATARIO_TELEFONE]
• E-mail: [LOCATARIO_EMAIL]

REPRESENTANTE LEGAL:
• Nome: [LOCATARIO_REP_NOME]
• Documento (CPF): [LOCATARIO_REP_CPF]
• RG: [LOCATARIO_REP_RG]
• Cargo: [LOCATARIO_REP_CARGO]

────────────────────────────────────────────────────
2. DO IMÓVEL

• Endereço Completo: [IMOVEL_ENDERECO]
• Tipo: Comercial
• Metragem: [IMOVEL_AREA] m²
• Descrição/Observações: [IMOVEL_DESCRICAO]
• Registro/Matrícula: [IMOVEL_MATRICULA]
• Cartório: [IMOVEL_CARTORIO]
• Inscrição Municipal (IPTU): [IMOVEL_INSCRICAO_IPTU]

────────────────────────────────────────────────────
3. DA DESTINAÇÃO COMERCIAL

O imóvel será utilizado para fins comerciais pela empresa, especificamente para:

[ATIVIDADE_COMERCIAL]

§1º PROIBIÇÕES:
É expressamente proibido à LOCATÁRIA:

a) Alteração da atividade comercial sem autorização prévia e por escrito do LOCADOR;

b) Sublocação total ou parcial do imóvel;

c) Armazenamento irregular de produtos perigosos, inflamáveis ou tóxicos;

d) Exercício de atividades que exijam licenças não apresentadas ou não aprovadas;

e) Uso do imóvel para fins residenciais;

f) Instalação de equipamentos que comprometam a estrutura do imóvel;

g) Exercício de atividades ilegais ou que causem incômodo à vizinhança.

§2º A LOCATÁRIA é integralmente responsável pela obtenção e manutenção de todas as licenças, alvarás e autorizações necessárias ao exercício de sua atividade comercial.

────────────────────────────────────────────────────
4. DO PRAZO

§1º VIGÊNCIA:
• Prazo contratual: [PRAZO_MESES] meses
• Data de Início: [DATA_INICIO]
• Data de Término: [DATA_FIM]

§2º RENOVAÇÃO:
• Renovação automática: [RENOVACAO_AUTOMATICA]
• Direito à ação renovatória (Lei 8.245/91, art. 51): [DIREITO_RENOVATORIA]

§3º AÇÃO RENOVATÓRIA:
Nos termos da Lei 8.245/91, a LOCATÁRIA terá direito à renovação do contrato se:
a) O contrato a renovar tiver sido celebrado por escrito e com prazo determinado;
b) O prazo mínimo do contrato, ou a soma dos prazos ininterruptos, for de 5 (cinco) anos;
c) A LOCATÁRIA estiver no mesmo ramo, pelo prazo mínimo e ininterrupto de 3 (três) anos.

§4º DENÚNCIA:
Na vigência por prazo indeterminado, a denúncia deverá ser comunicada com antecedência mínima de 30 (trinta) dias.

────────────────────────────────────────────────────
5. DO VALOR E PAGAMENTO

§1º ALUGUEL:
• Valor mensal do aluguel: R$ [VALOR_ALUGUEL] ([VALOR_ALUGUEL_EXTENSO])
• Vencimento: dia [DIA_VENCIMENTO] de cada mês

§2º ENCARGOS FINANCEIROS POR ATRASO:
Em caso de atraso no pagamento, incidirão:
• Multa: [MULTA_ATRASO]%
• Juros: [JUROS_ATRASO]% ao mês
• Correção monetária pelo índice: [INDICE_CORRECAO]

§3º REAJUSTE ANUAL:
O valor do aluguel será reajustado anualmente pelo índice [INDICE_REAJUSTE], ou outro que vier a substituí-lo, na data de aniversário do contrato.

§4º FORMA DE PAGAMENTO:
O pagamento será realizado exclusivamente via: [PLATAFORMA_PAGAMENTO]

Dados bancários / PIX: [DADOS_BANCARIOS]

────────────────────────────────────────────────────
6. DOS ENCARGOS

§1º RESPONSABILIDADE DA LOCATÁRIA:
• IPTU: [IPTU_RESPONSAVEL]
• Condomínio (se aplicável): [CONDOMINIO_RESPONSAVEL]
• Energia elétrica: [ENERGIA_RESPONSAVEL]
• Água/esgoto: [AGUA_RESPONSAVEL]
• Seguro incêndio obrigatório: [SEGURO_INCENDIO_RESPONSAVEL]
• Taxas de funcionamento, alvarás, vigilância sanitária e demais licenças: [TAXAS_FUNCIONAMENTO_RESPONSAVEL]
• Gás: [GAS_RESPONSAVEL]
• Taxa de lixo comercial: [TAXA_LIXO_RESPONSAVEL]

§2º RESPONSABILIDADE DO LOCADOR:
• Manutenção estrutural do imóvel (telhado, fundações, estruturas);
• Fornecimento do imóvel regularizado junto aos órgãos competentes;
• Pagamento de tributos que incidam sobre a propriedade;
• Reparos de vícios anteriores à locação.

§3º O não pagamento dos encargos de responsabilidade da LOCATÁRIA autoriza o LOCADOR a efetuar o pagamento e cobrá-lo juntamente com o aluguel.

────────────────────────────────────────────────────
7. DA VISTORIA

§1º VISTORIA INICIAL:
• Laudo de vistoria: [ANEXO_VISTORIA_INICIAL]
• Data da vistoria: [DATA_VISTORIA_INICIAL]

O imóvel será entregue pronto para o uso comercial declarado, nas condições descritas no laudo de vistoria inicial.

§2º VISTORIA FINAL:
• Laudo de vistoria: [ANEXO_VISTORIA_FINAL]
• Data da vistoria: [DATA_VISTORIA_FINAL]

§3º CONDIÇÕES DE DEVOLUÇÃO:
A LOCATÁRIA devolverá o imóvel nas mesmas condições em que recebeu, conforme laudo de vistoria inicial, ressalvado o desgaste natural decorrente do uso regular.

§4º DANOS:
Os danos constatados na vistoria final que não constem da vistoria inicial serão de responsabilidade da LOCATÁRIA, que deverá repará-los ou indenizá-los.

────────────────────────────────────────────────────
8. DAS OBRIGAÇÕES

§1º OBRIGAÇÕES DO LOCADOR:
O LOCADOR obriga-se a:

a) Entregar o imóvel em condições de servir ao uso comercial a que se destina;

b) Garantir a estabilidade estrutural do imóvel;

c) Atender aos reparos estruturais de sua responsabilidade legal;

d) Responder pelos vícios ou defeitos anteriores à locação;

e) Manter a regularidade documental do imóvel;

f) Não perturbar a posse da LOCATÁRIA durante a vigência do contrato;

g) Fornecer recibos e comprovantes de pagamento quando solicitado.

§2º OBRIGAÇÕES DA LOCATÁRIA:
A LOCATÁRIA obriga-se a:

a) Pagar pontualmente o aluguel e encargos nas datas estipuladas;

b) Utilizar o imóvel exclusivamente para a atividade comercial declarada;

c) Cumprir rigorosamente as normas municipais, sanitárias, ambientais e de segurança;

d) Manter em dia todas as licenças e alvarás necessários à sua atividade;

e) Responder por danos estruturais ou decorrentes de sua atividade;

f) Comunicar imediatamente ao LOCADOR qualquer dano ou defeito;

g) Permitir vistorias no imóvel mediante aviso prévio de 48 horas;

h) Devolver o imóvel nas mesmas condições em que recebeu;

i) Não realizar obras ou modificações sem autorização prévia e por escrito;

j) Manter seguro de responsabilidade civil da atividade;

k) Zelar pela limpeza e conservação do imóvel e áreas comuns;

l) Cumprir as normas do condomínio, se aplicável.

────────────────────────────────────────────────────
9. DA RESCISÃO

§1º MULTA RESCISÓRIA:
Em caso de rescisão antecipada durante o prazo determinado:
• Multa proporcional: [MULTA_RESCISORIA] meses de aluguel, proporcional ao tempo restante

§2º AVISO PRÉVIO:
• Prazo de aviso prévio: [DIAS_AVISO_PREVIO] dias

§3º HIPÓTESES DE RESCISÃO:
O contrato poderá ser rescindido nas seguintes hipóteses:

a) Por mútuo acordo entre as partes;

b) Por inadimplência de qualquer das partes;

c) Por infração contratual ou legal;

d) Por uso irregular do imóvel;

e) Por descumprimento de obrigações essenciais;

f) Nas demais hipóteses previstas na Lei 8.245/91.

§4º RESCISÃO POR INFRAÇÃO:
A rescisão por infração contratual sujeita a parte infratora à execução judicial, além das multas e indenizações previstas.

§5º DEVOLUÇÃO DO IMÓVEL:
Na rescisão, a LOCATÁRIA deverá:
a) Quitar todos os débitos pendentes;
b) Agendar vistoria final;
c) Entregar o imóvel nas condições da vistoria inicial;
d) Entregar as chaves ao LOCADOR.

────────────────────────────────────────────────────
10. DAS BENFEITORIAS

§1º As benfeitorias necessárias serão indenizadas, ainda que não autorizadas, ressalvada a hipótese de culpa do locatário.

§2º As benfeitorias úteis serão indenizadas somente se previamente autorizadas por escrito pelo LOCADOR.

§3º As benfeitorias voluptuárias não serão indenizadas e poderão ser levantadas pela LOCATÁRIA, desde que não causem danos ao imóvel.

§4º Salvo expressa autorização, a LOCATÁRIA não poderá alterar a forma interna ou externa do imóvel.

────────────────────────────────────────────────────
11. DA PROTEÇÃO DE DADOS (LGPD)

Os dados pessoais e empresariais fornecidos serão tratados conforme a Lei 13.709/2018 (LGPD), exclusivamente para:

• Execução e gestão do presente contrato
• Emissão de cobranças e recibos
• Comunicações relativas à locação
• Cumprimento de obrigações legais
• Registros e auditorias

────────────────────────────────────────────────────
12. DO FORO

Fica eleito o foro da comarca de [FORO_CIDADE_ESTADO] para dirimir quaisquer litígios oriundos deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

────────────────────────────────────────────────────
13. DA ASSINATURA DIGITAL E VALIDADE JURÍDICA

As partes reconhecem a validade jurídica das assinaturas eletrônicas apostas neste instrumento, nos termos da Medida Provisória 2.200-2/2001 e da Lei 14.063/2020.

Este documento foi assinado digitalmente através de plataforma certificada, garantindo:
• Autenticidade da identidade dos signatários
• Integridade do conteúdo
• Não repúdio das assinaturas
• Registro de data e hora (timestamp)

HASH DO DOCUMENTO: [HASH_DOCUMENTO]

REGISTRO DE IPs:
• Locador: [IP_LOCADOR]
• Locatária: [IP_LOCATARIO]

Data de Assinatura: [DATA_ASSINATURA]


ASSINAM DIGITALMENTE:


LOCADOR (PROPRIETÁRIO):
Nome: [LOCADOR_NOME]
CPF: [LOCADOR_CPF]
Data: [DATA_ASS_LOCADOR]


LOCATÁRIA (PESSOA JURÍDICA):
Razão Social: [LOCATARIO_RAZAO_SOCIAL]
CNPJ: [LOCATARIO_CNPJ]
Representante: [LOCATARIO_REP_NOME]
Cargo: [LOCATARIO_REP_CARGO]
Data: [DATA_ASS_LOCATARIO]

════════════════════════════════════════════════════════════════════════════════
                           FIM DO CONTRATO
════════════════════════════════════════════════════════════════════════════════`
};

const contratoLocacaoComercialSimplificado: ContractTemplate = {
  id: "contrato-locacao-comercial-simplificado",
  name: "Locação Comercial Simplificado - Proprietário PF / Locatário PJ",
  description: "Contrato simplificado de locação de imóvel comercial entre proprietário independente pessoa física e empresa (Pessoa Jurídica)",
  type: "CTR",
  allowedUserTypes: ['INDEPENDENT_OWNER'],
  propertyType: 'COMMERCIAL',
  landlordType: 'PF',
  tenantType: 'PJ',
  category: 'RENTAL',
  content: `════════════════════════════════════════════════════════════════════════════════
                    CONTRATO DE LOCAÇÃO COMERCIAL
            PROPRIETÁRIO INDEPENDENTE x INQUILINO (PESSOA JURÍDICA)
════════════════════════════════════════════════════════════════════════════════

Contrato completo para locação de imóvel comercial entre proprietário e empresa.

════════════════════════════════════════════════════════════════════════════════
                         CLÁUSULA 1ª - DAS PARTES
════════════════════════════════════════════════════════════════════════════════

PROPRIETÁRIO (LOCADOR)

Nome completo: [LOCADOR_NOME]
Documento: [LOCADOR_CPF]
Endereço: [LOCADOR_ENDERECO]
E-mail: [LOCADOR_EMAIL]
Telefone: [LOCADOR_TELEFONE]

────────────────────────────────────────────────────

LOCATÁRIA (PESSOA JURÍDICA)

Razão social: [LOCATARIO_RAZAO_SOCIAL]
CNPJ: [LOCATARIO_CNPJ]
Inscrição estadual: [LOCATARIO_INSCRICAO_ESTADUAL]
Endereço: [LOCATARIO_ENDERECO]
Telefone: [LOCATARIO_TELEFONE]
E-mail: [LOCATARIO_EMAIL]

────────────────────────────────────────────────────

REPRESENTANTE LEGAL

Nome: [LOCATARIO_REP_NOME]
Documento: [LOCATARIO_REP_CPF]
Cargo: [LOCATARIO_REP_CARGO]

════════════════════════════════════════════════════════════════════════════════
                        CLÁUSULA 2ª - DO IMÓVEL
════════════════════════════════════════════════════════════════════════════════

Endereço completo: [IMOVEL_ENDERECO]
Tipo: Comercial
Metragem: [IMOVEL_AREA] m²
Descrição/observações: [IMOVEL_DESCRICAO]
Registro/Matrícula: [IMOVEL_MATRICULA]

════════════════════════════════════════════════════════════════════════════════
                  CLÁUSULA 3ª - DA DESTINAÇÃO COMERCIAL
════════════════════════════════════════════════════════════════════════════════

O imóvel será utilizado para fins comerciais pela empresa, especificamente para:

[ATIVIDADE_COMERCIAL]

É proibido:

• Alteração da atividade sem autorização;
• Sublocação;
• Armazenamento irregular de produtos perigosos;
• Atividades que exijam licenças não apresentadas.

════════════════════════════════════════════════════════════════════════════════
                        CLÁUSULA 4ª - DO PRAZO
════════════════════════════════════════════════════════════════════════════════

Prazo contratual: [PRAZO_MESES] meses
Início: [DATA_INICIO]
Término: [DATA_TERMINO]
Renovação automática: [RENOVACAO_AUTOMATICA]
Direito à renovação comercial: [DIREITO_RENOVATORIA]

════════════════════════════════════════════════════════════════════════════════
                   CLÁUSULA 5ª - DO VALOR E PAGAMENTO
════════════════════════════════════════════════════════════════════════════════

Valor mensal do aluguel: R$ [VALOR_ALUGUEL]
Vencimento: dia [DIA_VENCIMENTO]

ENCARGOS FINANCEIROS:

• Multa por atraso: [PERCENTUAL_MULTA]%
• Juros: [PERCENTUAL_JUROS]% ao mês
• Correção anual: [INDICE_CORRECAO]

Pagamento exclusivamente via plataforma: [PLATAFORMA_PAGAMENTO]

════════════════════════════════════════════════════════════════════════════════
                      CLÁUSULA 6ª - DOS ENCARGOS
════════════════════════════════════════════════════════════════════════════════

RESPONSABILIDADE DA LOCATÁRIA:

• IPTU: [IPTU_RESPONSAVEL]
• Condomínio: [CONDOMINIO_RESPONSAVEL]
• Energia elétrica: [ENERGIA_RESPONSAVEL]
• Água/esgoto: [AGUA_RESPONSAVEL]
• Seguro incêndio obrigatório: [SEGURO_INCENDIO_RESPONSAVEL]
• Taxas de funcionamento, alvarás, vigilância sanitária e demais licenças:
  [TAXAS_FUNCIONAMENTO_RESPONSAVEL]

RESPONSABILIDADE DO LOCADOR:

• Manutenção estrutural;
• Fornecimento do imóvel regularizado.

════════════════════════════════════════════════════════════════════════════════
                       CLÁUSULA 7ª - DA VISTORIA
════════════════════════════════════════════════════════════════════════════════

Laudo obrigatório: [VISTORIA_ID]

O imóvel será entregue pronto para o uso comercial declarado.

════════════════════════════════════════════════════════════════════════════════
                     CLÁUSULA 8ª - DAS OBRIGAÇÕES
════════════════════════════════════════════════════════════════════════════════

DO LOCADOR:

• Garantir estabilidade estrutural.
• Atender reparos de responsabilidade legal.

DA LOCATÁRIA:

• Cumprir normas municipais e sanitárias.
• Responder por danos estruturais ou de atividade.
• Devolver o imóvel nas mesmas condições recebidas.

════════════════════════════════════════════════════════════════════════════════
                      CLÁUSULA 9ª - DA RESCISÃO
════════════════════════════════════════════════════════════════════════════════

Multa proporcional: [MULTA_RESCISORIA] meses de aluguel
Aviso prévio: [PRAZO_AVISO_PREVIO] dias

Rescisão por infração contratual sujeita a execução judicial.

════════════════════════════════════════════════════════════════════════════════
                        CLÁUSULA 10ª - DO FORO
════════════════════════════════════════════════════════════════════════════════

Comarca: [COMARCA]

════════════════════════════════════════════════════════════════════════════════
                     ASSINATURA ELETRÔNICA CERTIFICADA
════════════════════════════════════════════════════════════════════════════════

Assinatura eletrônica certificada via plataforma

Hash: [HASH_CONTRATO]
IP: [IP_REGISTRO]
Data: [DATA_ASSINATURA]

────────────────────────────────────────────────────

LOCADOR (PROPRIETÁRIO):
Nome: [LOCADOR_NOME]
CPF: [LOCADOR_CPF]
Data: [DATA_ASS_LOCADOR]

────────────────────────────────────────────────────

LOCATÁRIA (PESSOA JURÍDICA):
Razão Social: [LOCATARIO_RAZAO_SOCIAL]
CNPJ: [LOCATARIO_CNPJ]
Representante: [LOCATARIO_REP_NOME]
Cargo: [LOCATARIO_REP_CARGO]
Data: [DATA_ASS_LOCATARIO]

════════════════════════════════════════════════════════════════════════════════
                           FIM DO CONTRATO
════════════════════════════════════════════════════════════════════════════════`
};

const contratoLocacaoResidencialProprietarioPF: ContractTemplate = {
  id: "contrato-locacao-residencial-proprietario-pf",
  name: "Locação Residencial - Proprietário PF / Locatário PF",
  description: "Contrato de locação residencial entre proprietário independente pessoa física e inquilino pessoa física, com opção de fiador",
  type: "CTR",
  allowedUserTypes: ['INDEPENDENT_OWNER'],
  propertyType: 'RESIDENTIAL',
  landlordType: 'PF',
  tenantType: 'PF',
  category: 'RENTAL',
  content: `════════════════════════════════════════════════════════════════════════════════
                    CONTRATO DE LOCAÇÃO RESIDENCIAL
            PROPRIETÁRIO INDEPENDENTE x INQUILINO (PESSOA FÍSICA)
════════════════════════════════════════════════════════════════════════════════

CONTRATO DE LOCAÇÃO RESIDENCIAL que fazem entre si, de um lado o PROPRIETÁRIO,
e de outro o LOCATÁRIO, mediante as cláusulas e condições a seguir:

════════════════════════════════════════════════════════════════════════════════
                         CLÁUSULA 1ª - DAS PARTES
════════════════════════════════════════════════════════════════════════════════

PROPRIETÁRIO (LOCADOR)

Nome completo: [LOCADOR_NOME]
Nacionalidade: [LOCADOR_NACIONALIDADE]
Estado civil: [LOCADOR_ESTADO_CIVIL]
Profissão: [LOCADOR_PROFISSAO]
Documento (RG/CPF): [LOCADOR_RG] / [LOCADOR_CPF]
Endereço: [LOCADOR_ENDERECO]
E-mail: [LOCADOR_EMAIL]
Telefone: [LOCADOR_TELEFONE]

────────────────────────────────────────────────────

INQUILINO (LOCATÁRIO — PESSOA FÍSICA)

Nome completo: [LOCATARIO_NOME]
Nacionalidade: [LOCATARIO_NACIONALIDADE]
Estado civil: [LOCATARIO_ESTADO_CIVIL]
Profissão: [LOCATARIO_PROFISSAO]
Documento (RG/CPF): [LOCATARIO_RG] / [LOCATARIO_CPF]
Endereço: [LOCATARIO_ENDERECO]
E-mail: [LOCATARIO_EMAIL]
Telefone: [LOCATARIO_TELEFONE]

────────────────────────────────────────────────────

FIADOR (se houver)

Nome: [FIADOR_NOME]
Documento: [FIADOR_CPF]
Endereço: [FIADOR_ENDERECO]

════════════════════════════════════════════════════════════════════════════════
                        CLÁUSULA 2ª - DO IMÓVEL
════════════════════════════════════════════════════════════════════════════════

Endereço completo do imóvel: [IMOVEL_ENDERECO]
Tipo: Residencial
Descrição/observações: [IMOVEL_DESCRICAO]
Matrícula/Registro: [IMOVEL_MATRICULA]

Proprietário confirma que o imóvel está em condições de uso.

════════════════════════════════════════════════════════════════════════════════
                        CLÁUSULA 3ª - DO OBJETO
════════════════════════════════════════════════════════════════════════════════

O presente contrato tem por objeto a locação do imóvel acima descrito, destinado
exclusivamente para uso residencial, sendo vedado qualquer uso comercial ou
irregular.

════════════════════════════════════════════════════════════════════════════════
                        CLÁUSULA 4ª - DO PRAZO
════════════════════════════════════════════════════════════════════════════════

Prazo da locação: [PRAZO_MESES] meses
Início: [DATA_INICIO]
Término: [DATA_TERMINO]
Renovação automática: [RENOVACAO_AUTOMATICA]

════════════════════════════════════════════════════════════════════════════════
                CLÁUSULA 5ª - DO VALOR E FORMA DE PAGAMENTO
════════════════════════════════════════════════════════════════════════════════

Valor mensal da locação: R$ [VALOR_ALUGUEL]
Vencimento: todo dia [DIA_VENCIMENTO]
Multa por atraso: [PERCENTUAL_MULTA]%
Juros: [PERCENTUAL_JUROS]% ao mês
Correção anual pelo índice: [INDICE_CORRECAO] (IGP-M, IPCA, etc.)
Pagamento via plataforma: [PLATAFORMA_PAGAMENTO]

════════════════════════════════════════════════════════════════════════════════
                      CLÁUSULA 6ª - DOS ENCARGOS
════════════════════════════════════════════════════════════════════════════════

Responsabilidade do LOCATÁRIO:

• Água: [AGUA_RESPONSAVEL]
• Luz: [ENERGIA_RESPONSAVEL]
• Gás: [GAS_RESPONSAVEL]
• IPTU: [IPTU_RESPONSAVEL]
• Condomínio: [CONDOMINIO_RESPONSAVEL]
• Seguro incêndio obrigatório: [SEGURO_INCENDIO_RESPONSAVEL]

════════════════════════════════════════════════════════════════════════════════
                       CLÁUSULA 7ª - DA VISTORIA
════════════════════════════════════════════════════════════════════════════════

Será realizado Laudo de Vistoria Inicial e Final pela plataforma:
Link/ID da vistoria: [VISTORIA_ID]

════════════════════════════════════════════════════════════════════════════════
                 CLÁUSULA 8ª - DAS OBRIGAÇÕES DAS PARTES
════════════════════════════════════════════════════════════════════════════════

DO LOCADOR:

• Entregar o imóvel em condições de uso.
• Garantir o uso pacífico do imóvel.
• Realizar reparos estruturais.

DO LOCATÁRIO:

• Zelar pelo imóvel e devolver nas mesmas condições.
• Não alterar estrutura sem autorização.
• Permitir vistorias mediante aviso prévio.
• Pagar pontualmente os encargos.

════════════════════════════════════════════════════════════════════════════════
                      CLÁUSULA 9ª - DA RESCISÃO
════════════════════════════════════════════════════════════════════════════════

Multa rescisória proporcional: [MULTA_RESCISORIA] meses de aluguel
Aviso prévio: [PRAZO_AVISO_PREVIO] dias

Rescisão por descumprimento ensejará cobrança judicial.

════════════════════════════════════════════════════════════════════════════════
                        CLÁUSULA 10ª - DO FORO
════════════════════════════════════════════════════════════════════════════════

Fica eleito o foro da comarca de [COMARCA], renunciando a qualquer outro.

════════════════════════════════════════════════════════════════════════════════
                     ASSINATURA ELETRÔNICA CERTIFICADA
════════════════════════════════════════════════════════════════════════════════

Assinaturas eletrônicas registradas via plataforma:

Hash do contrato: [HASH_CONTRATO]
IP de registro: [IP_REGISTRO]
Data/hora: [DATA_ASSINATURA]

────────────────────────────────────────────────────

LOCADOR (PROPRIETÁRIO):
Nome: [LOCADOR_NOME]
CPF: [LOCADOR_CPF]
Data: [DATA_ASS_LOCADOR]

────────────────────────────────────────────────────

LOCATÁRIO (INQUILINO):
Nome: [LOCATARIO_NOME]
CPF: [LOCATARIO_CPF]
Data: [DATA_ASS_LOCATARIO]

────────────────────────────────────────────────────

FIADOR (se aplicável):
Nome: [FIADOR_NOME]
CPF: [FIADOR_CPF]
Data: [DATA_ASS_FIADOR]

════════════════════════════════════════════════════════════════════════════════
                           FIM DO CONTRATO
════════════════════════════════════════════════════════════════════════════════`
};

const contratoLocacaoRuralProprietarioIndependente: ContractTemplate = {
  id: "contrato-locacao-rural-proprietario-independente",
  name: "Locação Rural - Proprietário Independente / Inquilino PF",
  description: "Contrato de locação de imóvel rural (Fazenda/Sítio/Chácara) entre proprietário independente e inquilino pessoa física, conforme Lei 4.504/1964 e Decreto 59.566/66",
  type: "CTR",
  allowedUserTypes: ['INDEPENDENT_OWNER'],
  propertyType: 'RURAL',
  landlordType: 'PF',
  tenantType: 'PF',
  category: 'RENTAL',
  content: `════════════════════════════════════════════════════════════════════════════════
           CONTRATO DE LOCAÇÃO DE IMÓVEL RURAL (Fazenda / Sítio / Chácara)
            PROPRIETÁRIO INDEPENDENTE x INQUILINO — MODELO COMPLETO
════════════════════════════════════════════════════════════════════════════════

                    (Lei nº 4.504/1964 – Estatuto da Terra /
                     Decreto 59.566/66 / Código Civil)

════════════════════════════════════════════════════════════════════════════════
                         CLÁUSULA 1ª - PARTES
════════════════════════════════════════════════════════════════════════════════

LOCADOR

Nome: [LOCADOR_NOME]
Documento: [LOCADOR_CPF]
Endereço: [LOCADOR_ENDERECO]
Telefone/E-mail: [LOCADOR_TELEFONE] / [LOCADOR_EMAIL]

────────────────────────────────────────────────────

LOCATÁRIO (INQUILINO)

Nome: [LOCATARIO_NOME]
Documento: [LOCATARIO_CPF]
Endereço: [LOCATARIO_ENDERECO]
Telefone/E-mail: [LOCATARIO_TELEFONE] / [LOCATARIO_EMAIL]

════════════════════════════════════════════════════════════════════════════════
                      CLÁUSULA 2ª - IMÓVEL RURAL
════════════════════════════════════════════════════════════════════════════════

Endereço: [IMOVEL_ENDERECO]
Área total (hectares): [IMOVEL_AREA_HECTARES] ha
Tipo do imóvel: [TIPO_IMOVEL_RURAL] (Fazenda / Sítio / Chácara / Pastagem / Agropecuária / Residência Rural)
Matrícula/Registro: [IMOVEL_MATRICULA]
Descrição: [IMOVEL_DESCRICAO]

════════════════════════════════════════════════════════════════════════════════
                       CLÁUSULA 3ª - FINALIDADE
════════════════════════════════════════════════════════════════════════════════

Finalidade principal: [FINALIDADE_RURAL]

Permitido: uso rural, moradia, criação de animais [ATIVIDADES_PERMITIDAS]

Proibido:
• Desmatamento irregular;
• Queimadas não autorizadas;
• Alteração de Áreas de Preservação Permanente (APP);
• Sublocação total ou parcial;
• Atividades que degradem o meio ambiente;
• Uso diverso da finalidade contratada.

════════════════════════════════════════════════════════════════════════════════
                        CLÁUSULA 4ª - PRAZO
════════════════════════════════════════════════════════════════════════════════

Prazo da locação: [PRAZO_MESES] meses
Início: [DATA_INICIO]
Término: [DATA_TERMINO]

OBSERVAÇÃO: O contrato rural não possui renovação automática, conforme
legislação agrária vigente. Eventual prorrogação deverá ser formalizada
por termo aditivo.

════════════════════════════════════════════════════════════════════════════════
                        CLÁUSULA 5ª - VALORES
════════════════════════════════════════════════════════════════════════════════

Aluguel mensal: R$ [VALOR_ALUGUEL]
Data de vencimento: dia [DIA_VENCIMENTO] de cada mês
Multa por atraso: [PERCENTUAL_MULTA]%
Juros: [PERCENTUAL_JUROS]% ao mês
Correção anual: [INDICE_CORRECAO]

Pagamento via plataforma: [PLATAFORMA_PAGAMENTO]

════════════════════════════════════════════════════════════════════════════════
                       CLÁUSULA 6ª - ENCARGOS
════════════════════════════════════════════════════════════════════════════════

RESPONSABILIDADE DO LOCATÁRIO:

• Contas de energia rural: [ENERGIA_RESPONSAVEL]
• Água/poço/artesiano: [AGUA_RESPONSAVEL]
• Manutenção de pastos leves: [PASTOS_RESPONSAVEL]
• Limpeza e conservação: [CONSERVACAO_RESPONSAVEL]

RESPONSABILIDADE DO LOCADOR:

• Manutenção estrutural de cercas, curral, casa-sede;
• Impostos territoriais rurais (ITR);
• Reparos de grande porte em instalações fixas.

════════════════════════════════════════════════════════════════════════════════
                       CLÁUSULA 7ª - VISTORIA
════════════════════════════════════════════════════════════════════════════════

Laudo rural ID: [VISTORIA_ID]

Será realizado laudo de vistoria inicial e final, documentando:
• Estado das instalações (casa-sede, currais, cercas, galpões);
• Condições de pastagens e áreas de cultivo;
• Funcionamento de poços, cisternas e sistemas de irrigação;
• Inventário de benfeitorias existentes.

════════════════════════════════════════════════════════════════════════════════
                     CLÁUSULA 8ª - OBRIGAÇÕES
════════════════════════════════════════════════════════════════════════════════

DO LOCADOR:

• Entregar o imóvel em condições de uso para a finalidade contratada;
• Garantir o uso pacífico da propriedade;
• Realizar manutenção estrutural de edificações e instalações fixas;
• Fornecer documentação regularizada do imóvel;
• Pagar ITR e tributos de responsabilidade do proprietário.

DO LOCATÁRIO:

• Utilizar o imóvel exclusivamente para a finalidade contratada;
• Zelar pela conservação do imóvel e instalações;
• Preservar Áreas de Preservação Permanente e Reserva Legal;
• Não realizar queimadas ou desmatamento irregular;
• Permitir vistorias mediante agendamento prévio;
• Devolver o imóvel nas mesmas condições recebidas;
• Comunicar imediatamente qualquer dano ou problema estrutural;
• Cumprir legislação ambiental e agrária aplicável.

════════════════════════════════════════════════════════════════════════════════
                      CLÁUSULA 9ª - RESCISÃO
════════════════════════════════════════════════════════════════════════════════

Multa rescisória: [MULTA_RESCISORIA] meses de aluguel, proporcional ao tempo restante
Aviso prévio: [PRAZO_AVISO_PREVIO] dias

São motivos de rescisão imediata pelo LOCADOR:
• Uso diverso da finalidade contratada;
• Sublocação não autorizada;
• Danos ambientais causados pelo locatário;
• Inadimplência superior a 60 dias;
• Descumprimento de cláusulas contratuais.

Rescisão por descumprimento ensejará cobrança judicial e perdas e danos.

════════════════════════════════════════════════════════════════════════════════
                    CLÁUSULA 10ª - BENFEITORIAS
════════════════════════════════════════════════════════════════════════════════

Benfeitorias necessárias: serão indenizadas, desde que autorizadas previamente.

Benfeitorias úteis: serão indenizadas somente se expressamente autorizadas
por escrito pelo LOCADOR.

Benfeitorias voluptuárias: não serão indenizadas, podendo o LOCATÁRIO
retirá-las sem causar danos ao imóvel.

════════════════════════════════════════════════════════════════════════════════
                        CLÁUSULA 11ª - DO FORO
════════════════════════════════════════════════════════════════════════════════

Fica eleito o foro da comarca de [COMARCA], com renúncia a qualquer outro,
por mais privilegiado que seja, para dirimir quaisquer questões oriundas
deste contrato.

════════════════════════════════════════════════════════════════════════════════
                     ASSINATURA ELETRÔNICA CERTIFICADA
════════════════════════════════════════════════════════════════════════════════

Assinaturas eletrônicas registradas via plataforma, com validade jurídica
conforme MP 2.200-2/2001 e Lei 14.063/2020.

Hash do contrato: [HASH_CONTRATO]
IP de registro: [IP_REGISTRO]
Data/hora: [DATA_ASSINATURA]

────────────────────────────────────────────────────

LOCADOR (PROPRIETÁRIO):
Nome: [LOCADOR_NOME]
CPF: [LOCADOR_CPF]
Data: [DATA_ASS_LOCADOR]

────────────────────────────────────────────────────

LOCATÁRIO (INQUILINO):
Nome: [LOCATARIO_NOME]
CPF: [LOCATARIO_CPF]
Data: [DATA_ASS_LOCATARIO]

════════════════════════════════════════════════════════════════════════════════
                           FIM DO CONTRATO
════════════════════════════════════════════════════════════════════════════════`
};

const contratoResidenciaRural: ContractTemplate = {
  id: "contrato-residencia-rural",
  name: "Locação Residência Rural - Casa Rural",
  description: "Contrato de locação de residência rural (Casa Rural / Casa de Colono / Casa Sede) para uso residencial contínuo",
  type: "CTR",
  allowedUserTypes: ['INDEPENDENT_OWNER'],
  propertyType: 'RURAL',
  landlordType: 'PF',
  tenantType: 'PF',
  category: 'RENTAL',
  content: `════════════════════════════════════════════════════════════════════════════════
                   CONTRATO DE LOCAÇÃO DE RESIDÊNCIA RURAL
                              (Casa Rural)
════════════════════════════════════════════════════════════════════════════════

════════════════════════════════════════════════════════════════════════════════
                         CLÁUSULA 1ª - PARTES
════════════════════════════════════════════════════════════════════════════════

LOCADOR

Nome: [LOCADOR_NOME]
Documento: [LOCADOR_CPF]
Endereço: [LOCADOR_ENDERECO]

────────────────────────────────────────────────────

LOCATÁRIO

Nome: [LOCATARIO_NOME]
Documento: [LOCATARIO_CPF]
Endereço: [LOCATARIO_ENDERECO]

════════════════════════════════════════════════════════════════════════════════
                        CLÁUSULA 2ª - IMÓVEL
════════════════════════════════════════════════════════════════════════════════

Endereço rural: [IMOVEL_ENDERECO]
Tipo: Residência Rural / Casa de Colono / Casa Sede
Descrição: [IMOVEL_DESCRICAO]
Área construída: [IMOVEL_AREA_CONSTRUIDA] m²
Matrícula: [IMOVEL_MATRICULA]

════════════════════════════════════════════════════════════════════════════════
                       CLÁUSULA 3ª - FINALIDADE
════════════════════════════════════════════════════════════════════════════════

Somente uso residencial contínuo.

Proibido:
• Criação intensiva de animais dentro da residência;
• Atividades comerciais;
• Sublocação total ou parcial;
• Alterações estruturais sem autorização.

════════════════════════════════════════════════════════════════════════════════
                        CLÁUSULA 4ª - PRAZO
════════════════════════════════════════════════════════════════════════════════

Prazo: [PRAZO_MESES] meses
Início: [DATA_INICIO]
Término: [DATA_TERMINO]

════════════════════════════════════════════════════════════════════════════════
                        CLÁUSULA 5ª - VALORES
════════════════════════════════════════════════════════════════════════════════

Aluguel: R$ [VALOR_ALUGUEL]
Vencimento: dia [DIA_VENCIMENTO] de cada mês
Correção anual: [INDICE_CORRECAO]
Multa por atraso: [PERCENTUAL_MULTA]%
Juros: [PERCENTUAL_JUROS]% ao mês

Pagamento via: [PLATAFORMA_PAGAMENTO]

════════════════════════════════════════════════════════════════════════════════
                       CLÁUSULA 6ª - ENCARGOS
════════════════════════════════════════════════════════════════════════════════

RESPONSABILIDADE DO LOCATÁRIO:

• Água: [AGUA_RESPONSAVEL]
• Energia: [ENERGIA_RESPONSAVEL]
• Manutenção de jardim/pomar simples: [MANUTENCAO_JARDIM_RESPONSAVEL]

RESPONSABILIDADE DO LOCADOR:

• Reparos estruturais;
• Impostos rurais (ITR).

════════════════════════════════════════════════════════════════════════════════
                       CLÁUSULA 7ª - VISTORIA
════════════════════════════════════════════════════════════════════════════════

Laudo rural ID: [VISTORIA_ID]

Será realizado laudo de vistoria inicial e final documentando o estado
da residência e suas instalações.

════════════════════════════════════════════════════════════════════════════════
                     CLÁUSULA 8ª - OBRIGAÇÕES
════════════════════════════════════════════════════════════════════════════════

DO LOCADOR:

• Entregar o imóvel habitável e seguro;
• Garantir condições estruturais adequadas;
• Realizar reparos de responsabilidade estrutural.

DO LOCATÁRIO:

• Uso adequado da residência;
• Permitir vistoria mediante agendamento prévio;
• Devolver o imóvel conforme laudo de vistoria;
• Zelar pela conservação da residência e áreas externas.

════════════════════════════════════════════════════════════════════════════════
                      CLÁUSULA 9ª - RESCISÃO
════════════════════════════════════════════════════════════════════════════════

Multa rescisória: [MULTA_RESCISORIA] meses de aluguel
Aviso prévio: [PRAZO_AVISO_PREVIO] dias

Rescisão por descumprimento ensejará cobrança judicial.

════════════════════════════════════════════════════════════════════════════════
                        CLÁUSULA 10ª - FORO
════════════════════════════════════════════════════════════════════════════════

Comarca: [COMARCA]

════════════════════════════════════════════════════════════════════════════════
                     ASSINATURA ELETRÔNICA CERTIFICADA
════════════════════════════════════════════════════════════════════════════════

Assinatura digital

Hash: [HASH_CONTRATO]
IP: [IP_REGISTRO]
Data: [DATA_ASSINATURA]

────────────────────────────────────────────────────

LOCADOR:
Nome: [LOCADOR_NOME]
CPF: [LOCADOR_CPF]
Data: [DATA_ASS_LOCADOR]

────────────────────────────────────────────────────

LOCATÁRIO:
Nome: [LOCATARIO_NOME]
CPF: [LOCATARIO_CPF]
Data: [DATA_ASS_LOCATARIO]

════════════════════════════════════════════════════════════════════════════════
                           FIM DO CONTRATO
════════════════════════════════════════════════════════════════════════════════`
};

const contratoLocacaoResidencialPFComFiador: ContractTemplate = {
  id: "contrato-locacao-residencial-pf-fiador",
  name: "Locação Residencial PF - Com Fiador Opcional",
  description: "Contrato de locação residencial entre pessoa física (locador) e pessoa física (locatário) com opção de fiador",
  type: "CTR",
  allowedUserTypes: ['INDEPENDENT_OWNER'],
  propertyType: 'RESIDENTIAL',
  landlordType: 'PF',
  tenantType: 'PF',
  category: 'RENTAL',
  content: `════════════════════════════════════════════════════════════════════════════════
                      CONTRATO DE LOCAÇÃO RESIDENCIAL
                           (PESSOA FÍSICA)
════════════════════════════════════════════════════════════════════════════════

════════════════════════════════════════════════════════════════════════════════
                         CLÁUSULA 1ª - DAS PARTES
════════════════════════════════════════════════════════════════════════════════

LOCADOR

Nome: [LOCADOR_NOME]
Documento: [LOCADOR_CPF]
Estado civil: [LOCADOR_ESTADO_CIVIL]
Profissão: [LOCADOR_PROFISSAO]
Endereço: [LOCADOR_ENDERECO]
Telefone/E-mail: [LOCADOR_TELEFONE] / [LOCADOR_EMAIL]

────────────────────────────────────────────────────

LOCATÁRIO

Nome: [LOCATARIO_NOME]
Documento: [LOCATARIO_CPF]
Estado civil: [LOCATARIO_ESTADO_CIVIL]
Profissão: [LOCATARIO_PROFISSAO]
Endereço: [LOCATARIO_ENDERECO]
Telefone/E-mail: [LOCATARIO_TELEFONE] / [LOCATARIO_EMAIL]

────────────────────────────────────────────────────

FIADOR (opcional)

Nome: [FIADOR_NOME]
Documento: [FIADOR_CPF]
Endereço: [FIADOR_ENDERECO]

════════════════════════════════════════════════════════════════════════════════
                        CLÁUSULA 2ª - DO IMÓVEL
════════════════════════════════════════════════════════════════════════════════

Endereço: [IMOVEL_ENDERECO]
Tipo: Residencial
Descrição: [IMOVEL_DESCRICAO]
Matrícula: [IMOVEL_MATRICULA]

════════════════════════════════════════════════════════════════════════════════
                       CLÁUSULA 3ª - FINALIDADE
════════════════════════════════════════════════════════════════════════════════

Uso exclusivamente residencial, vedado uso comercial ou hospedagem curta
sem permissão prévia e expressa do LOCADOR.

════════════════════════════════════════════════════════════════════════════════
                        CLÁUSULA 4ª - PRAZO
════════════════════════════════════════════════════════════════════════════════

Duração: [PRAZO_MESES] meses
Início: [DATA_INICIO]
Término: [DATA_TERMINO]
Renovação automática: [RENOVACAO_AUTOMATICA]

════════════════════════════════════════════════════════════════════════════════
                        CLÁUSULA 5ª - VALORES
════════════════════════════════════════════════════════════════════════════════

Aluguel mensal: R$ [VALOR_ALUGUEL]
Vencimento: dia [DIA_VENCIMENTO] de cada mês
Multa por atraso: [PERCENTUAL_MULTA]%
Juros: [PERCENTUAL_JUROS]% ao mês
Correção anual: [INDICE_CORRECAO]

Pagamento via: [PLATAFORMA_PAGAMENTO]

════════════════════════════════════════════════════════════════════════════════
                       CLÁUSULA 6ª - ENCARGOS
════════════════════════════════════════════════════════════════════════════════

DO LOCATÁRIO:

• Água: [AGUA_RESPONSAVEL]
• Luz: [ENERGIA_RESPONSAVEL]
• Gás: [GAS_RESPONSAVEL]
• IPTU: [IPTU_RESPONSAVEL]
• Condomínio: [CONDOMINIO_RESPONSAVEL]
• Seguro obrigatório: [SEGURO_INCENDIO_RESPONSAVEL]

DO LOCADOR:

• Reparos estruturais.

════════════════════════════════════════════════════════════════════════════════
                       CLÁUSULA 7ª - VISTORIA
════════════════════════════════════════════════════════════════════════════════

Laudo ID: [VISTORIA_ID]

Será realizado laudo de vistoria inicial e final documentando o estado
do imóvel e suas instalações.

════════════════════════════════════════════════════════════════════════════════
                     CLÁUSULA 8ª - OBRIGAÇÕES
════════════════════════════════════════════════════════════════════════════════

DO LOCADOR:

• Garantir uso pacífico do imóvel;
• Entregar o imóvel em condições de uso;
• Realizar reparos estruturais.

DO LOCATÁRIO:

• Zelar pelo imóvel;
• Permitir vistoria mediante agendamento prévio;
• Restituir o imóvel conforme laudo de vistoria;
• Pagar pontualmente os encargos.

════════════════════════════════════════════════════════════════════════════════
                      CLÁUSULA 9ª - RESCISÃO
════════════════════════════════════════════════════════════════════════════════

Multa rescisória: [MULTA_RESCISORIA] meses de aluguel
Aviso prévio: [PRAZO_AVISO_PREVIO] dias

Rescisão por descumprimento ensejará cobrança judicial.

════════════════════════════════════════════════════════════════════════════════
                        CLÁUSULA 10ª - FORO
════════════════════════════════════════════════════════════════════════════════

Comarca: [COMARCA]

════════════════════════════════════════════════════════════════════════════════
                     ASSINATURA ELETRÔNICA CERTIFICADA
════════════════════════════════════════════════════════════════════════════════

Assinatura digital

Hash: [HASH_CONTRATO]
IP: [IP_REGISTRO]
Data: [DATA_ASSINATURA]

────────────────────────────────────────────────────

LOCADOR:
Nome: [LOCADOR_NOME]
CPF: [LOCADOR_CPF]
Data: [DATA_ASS_LOCADOR]

────────────────────────────────────────────────────

LOCATÁRIO:
Nome: [LOCATARIO_NOME]
CPF: [LOCATARIO_CPF]
Data: [DATA_ASS_LOCATARIO]

────────────────────────────────────────────────────

FIADOR (se aplicável):
Nome: [FIADOR_NOME]
CPF: [FIADOR_CPF]
Data: [DATA_ASS_FIADOR]

════════════════════════════════════════════════════════════════════════════════
                           FIM DO CONTRATO
════════════════════════════════════════════════════════════════════════════════`
};

export const contractTemplates: ContractTemplate[] = [
  adminImobiliariaPfLocatario,
  administracaoImovel,
  contratoAdministracaoImovel,
  contratoLocacaoImovelRural,
  contratoLocacaoResidencialPadrao,
  contratoAdministracaoLocacaoComercialPJ,
  contratoLocacaoRuralImobiliariaPJ,
  contratoAdministracaoLocacaoResidencialPJ,
  contratoAdministracaoImovelLocadorPfLocatarioPf,
  contratoLocacaoRuralLocadoresPfLocatarioPj,
  contratoLocacaoResidencial,
  contratoLocacaoComercialProprietarioPJ,
  contratoLocacaoComercialSimplificado,
  contratoLocacaoResidencialProprietarioPF,
  contratoLocacaoRuralProprietarioIndependente,
  contratoResidenciaRural,
  contratoLocacaoResidencialPFComFiador,
];

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
