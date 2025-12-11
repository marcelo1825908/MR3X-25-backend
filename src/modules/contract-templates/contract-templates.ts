export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  type: 'CTR' | 'ACD' | 'VST'; // Contract, Accord, Inspection
}

export const contractTemplates: ContractTemplate[] = [
  {
    id: "residential-pf-pf",
    name: "Locação Residencial - CPF x CPF",
    description: "Contrato entre pessoas físicas para imóvel residencial",
    type: "CTR",
    content: `**CONTRATO DE LOCAÇÃO RESIDENCIAL ENTRE PESSOAS FÍSICAS**

Pelo presente instrumento particular de contrato de locação residencial, as partes:

**CORRETOR RESPONSÁVEL:**
Nome: [NOME_CORRETOR]
CRECI: [CRECI_CORRETOR]

**LOCADOR(A):**
Nome: [NOME_LOCADOR]
CPF: [CPF_LOCADOR]
Endereço: [ENDERECO_LOCADOR]
E-mail: [EMAIL_LOCADOR]
Telefone: [TELEFONE_LOCADOR]

**LOCATÁRIO(A):**
Nome: [NOME_LOCATARIO]
CPF: [CPF_LOCATARIO]
Endereço: [ENDERECO_LOCATARIO]
E-mail: [EMAIL_LOCATARIO]
Telefone: [TELEFONE_LOCATARIO]

Têm entre si, justo e contratado, o que segue:

**CLÁUSULA 1 - OBJETO DO CONTRATO**

1.1. O LOCADOR(a) dá em locação ao LOCATÁRIO(a) o imóvel de sua propriedade, localizado à [ENDERECO_IMOVEL], composto de [DESCRICAO_IMOVEL].

1.2. A locação destina-se exclusivamente para fins residenciais, sendo vedada qualquer outra utilização.

**CLÁUSULA 2 - PRAZO**

2.1. O prazo da locação será de [PRAZO_MESES] meses, com início em [DATA_INICIO] e término em [DATA_FIM], podendo ser prorrogado por acordo entre as partes.

2.2. Após o término, caso o LOCATÁRIO continue no imóvel sem oposição, a locação prorrogar-se-á por prazo indeterminado, nos termos do artigo 47 da Lei nº 8.245/91.

**CLÁUSULA 3 - VALOR E FORMA DE PAGAMENTO**

3.1. O aluguel mensal será de R$ [VALOR_ALUGUEL], com vencimento todo dia [DIA_VENCIMENTO] de cada mês, mediante pagamento via plataforma digital MR3X, Pix, boleto ou outro meio acordado.

3.2. O valor será reajustado anualmente, com base no índice [INDICE_REAJUSTE], conforme a legislação vigente.

**CLÁUSULA 4 - ENCARGOS**

4.1. Ficam a cargo do LOCATÁRIO:
- Pagamento do aluguel nas datas pactuadas;
- Despesas de consumo: água, luz, gás, internet, etc.;
- IPTU e taxa de condomínio (caso aplicável);
- Pequenos reparos decorrentes do uso normal do imóvel.

4.2. Ficam a cargo do LOCADOR:
- Impostos extraordinários;
- Obras estruturais;
- Garantir a entrega do imóvel em condições de uso.

**CLÁUSULA 5 - MULTA E JUROS POR ATRASO**

5.1. Em caso de atraso no pagamento do aluguel ou encargos, incidirá:
- Multa de [MULTA_ATRASO] sobre o valor devido (art. 413 do Código Civil);
- Juros moratórios de [JUROS_MORA] ao mês;
- Correção monetária conforme índice pactuado.

**CLÁUSULA 6 - GARANTIA LOCATÍCIA**

6.1. O presente contrato será garantido por [TIPO_GARANTIA], nos termos dos artigos 37 e 38 da Lei do Inquilinato.

**CLÁUSULA 7 - RESCISÃO CONTRATUAL**

7.1. Em caso de rescisão antecipada por iniciativa do LOCATÁRIO, será devida multa proporcional ao tempo restante do contrato, limitada a 3 (três) aluguéis.

7.2. O LOCADOR poderá rescindir o contrato em caso de inadimplência superior a 3 (três) meses ou descumprimento contratual.

**CLÁUSULA 8 - FORO**

8.1. Fica eleito o foro da comarca de [COMARCA], para dirimir eventuais dúvidas ou litígios.

E por estarem assim justos e contratados, firmam o presente instrumento em 2 (duas) vias de igual teor e forma, para que produza seus efeitos legais.

[CIDADE], [DATA_ASSINATURA]

---

**ASSINATURAS DIGITAIS**

**LOCADOR(A):**
[ASSINATURA_LOCADOR]

**LOCATÁRIO(A):**
[ASSINATURA_LOCATARIO]

**TESTEMUNHA:**
[ASSINATURA_TESTEMUNHA]

`
  },
  {
    id: "residential-pf-pj",
    name: "Locação Residencial - CPF x CNPJ",
    description: "Locador pessoa física e locatário pessoa jurídica",
    type: "CTR",
    content: `**CONTRATO DE LOCAÇÃO RESIDENCIAL – LOCADOR PESSOA FÍSICA E LOCATÁRIO PESSOA JURÍDICA**

Pelo presente instrumento particular, as partes a seguir identificadas celebram o presente contrato de locação residencial:

**CORRETOR RESPONSÁVEL:**
Nome: [NOME_CORRETOR]
CRECI: [CRECI_CORRETOR]

**LOCADOR(A) – PESSOA FÍSICA:**
Nome: [NOME_LOCADOR]
CPF: [CPF_LOCADOR]
Endereço: [ENDERECO_LOCADOR]
E-mail: [EMAIL_LOCADOR]
Telefone: [TELEFONE_LOCADOR]

**LOCATÁRIO(A) – PESSOA JURÍDICA:**
Razão Social: [RAZAO_SOCIAL_LOCATARIO]
CNPJ: [CNPJ_LOCATARIO]
Endereço: [ENDERECO_LOCATARIO]
Representante Legal: [REPRESENTANTE_LOCATARIO]
Cargo: [CARGO_LOCATARIO]
CPF: [CPF_REPRESENTANTE_LOCATARIO]
E-mail: [EMAIL_LOCATARIO]
Telefone: [TELEFONE_LOCATARIO]

**CLÁUSULA 1 – OBJETO**

1.1. O LOCADOR(a) dá em locação ao LOCATÁRIO(a) o imóvel residencial localizado à [ENDERECO_IMOVEL].

1.2. O imóvel será utilizado exclusivamente para moradia de colaborador(es), executivo(s) ou representante(s) do LOCATÁRIO, sendo vedado o uso comercial, sublocação, cessão ou desvio de finalidade.

**CLÁUSULA 2 – PRAZO DE LOCAÇÃO**

2.1. O prazo da locação será de [PRAZO_MESES] meses, com início em [DATA_INICIO] e término em [DATA_FIM], podendo ser prorrogado por prazo indeterminado, conforme artigo 47 da Lei nº 8.245/91.

**CLÁUSULA 3 – ALUGUEL E ENCARGOS**

3.1. O aluguel mensal é de R$ [VALOR_ALUGUEL], com vencimento até o dia [DIA_VENCIMENTO] de cada mês.

3.2. O pagamento será feito via plataforma MR3X, Pix, boleto ou outro meio digital acordado.

3.3. O valor será reajustado anualmente, conforme o índice [INDICE_REAJUSTE], nos termos legais.

**CLÁUSULA 4 – DESPESAS E ENCARGOS**

4.1. Serão de responsabilidade do LOCATÁRIO:
- Contas de consumo: água, energia, gás, internet, etc.;
- Taxas de condomínio ordinárias;
- IPTU, caso acordado entre as partes;
- Pequenos reparos decorrentes do uso habitual do imóvel.

4.2. São de responsabilidade do LOCADOR:
- Obrigações tributárias que não forem expressamente atribuídas ao LOCATÁRIO;
- Manutenção estrutural e reparos de grande porte;
- Garantir a entrega do imóvel em perfeitas condições de uso.

**CLÁUSULA 5 – GARANTIA LOCATÍCIA**

5.1. A presente locação será garantida por [TIPO_GARANTIA], conforme previsto nos artigos 37 e seguintes da Lei nº 8.245/91.

**CLÁUSULA 6 – MULTAS E ATRASOS**

6.1. Em caso de inadimplemento, incidirão:
- Multa de [MULTA_ATRASO] sobre o valor devido;
- Juros de mora de [JUROS_MORA] ao mês;
- Correção monetária pelo índice pactuado.

**CLÁUSULA 7 – VISTORIA E DEVOLUÇÃO**

7.1. Será realizada vistoria inicial, com registro fotográfico e laudo descritivo, pela plataforma ou presencialmente.

7.2. Ao final do contrato, será realizada vistoria de saída. A entrega das chaves ocorrerá após a quitação total e confirmação da restituição do imóvel em condições equivalentes.

**CLÁUSULA 8 – FORO**

8.1. Fica eleito o foro da comarca de [COMARCA], para dirimir eventuais dúvidas ou litígios.

E por estarem assim justos e contratados, firmam o presente instrumento.

[CIDADE], [DATA_ASSINATURA]

---

**ASSINATURAS DIGITAIS**

**LOCADOR(A):**
[ASSINATURA_LOCADOR]

**LOCATÁRIO(A):**
[ASSINATURA_LOCATARIO]

**TESTEMUNHA:**
[ASSINATURA_TESTEMUNHA]

`
  },
  {
    id: "residential-pj-pf",
    name: "Locação Residencial - CNPJ x CPF",
    description: "Proprietário pessoa jurídica para inquilino pessoa física",
    type: "CTR",
    content: `**CONTRATO DE LOCAÇÃO RESIDENCIAL – PROPRIETÁRIO CNPJ PARA INQUILINO PESSOA FÍSICA**

Pelo presente instrumento particular de contrato de locação residencial, as partes:

**CORRETOR RESPONSÁVEL:**
Nome: [NOME_CORRETOR]
CRECI: [CRECI_CORRETOR]

**LOCADOR(A) – PESSOA JURÍDICA:**
Razão Social: [RAZAO_SOCIAL_LOCADOR]
CNPJ: [CNPJ_LOCADOR]
Endereço: [ENDERECO_LOCADOR]
Representante Legal: [REPRESENTANTE_LOCADOR]
CPF do Representante: [CPF_REPRESENTANTE_LOCADOR]
E-mail: [EMAIL_LOCADOR]
Telefone: [TELEFONE_LOCADOR]

**LOCATÁRIO(A) – PESSOA FÍSICA:**
Nome: [NOME_LOCATARIO]
CPF: [CPF_LOCATARIO]
Endereço: [ENDERECO_LOCATARIO]
E-mail: [EMAIL_LOCATARIO]
Telefone: [TELEFONE_LOCATARIO]

**CLÁUSULA 1 – OBJETO DO CONTRATO**

1.1. O LOCADOR, na qualidade de pessoa jurídica, cede em locação ao LOCATÁRIO o imóvel residencial situado à [ENDERECO_IMOVEL], conforme registro imobiliário.

1.2. A presente locação destina-se exclusivamente à moradia, sendo vedado o uso para fins comerciais, sublocação ou cessão a terceiros sem consentimento por escrito do LOCADOR.

**CLÁUSULA 2 – PRAZO DE LOCAÇÃO**

2.1. O prazo de locação será de [PRAZO_MESES] meses, com início em [DATA_INICIO] e término em [DATA_FIM], podendo ser prorrogado automaticamente por prazo indeterminado, nos termos da Lei do Inquilinato.

**CLÁUSULA 3 – VALOR E FORMA DE PAGAMENTO**

3.1. O aluguel mensal será de R$ [VALOR_ALUGUEL], com vencimento todo dia [DIA_VENCIMENTO] de cada mês.

3.2. O pagamento será realizado via plataforma digital MR3X, Pix, boleto bancário ou outro meio eletrônico previamente acordado.

3.3. O aluguel será reajustado anualmente com base no índice [INDICE_REAJUSTE], conforme previsto na Lei nº 8.245/91.

**CLÁUSULA 4 – ENCARGOS DO IMÓVEL**

4.1. São de responsabilidade do LOCATÁRIO:
- Consumo de água, energia elétrica, gás e internet;
- Taxa condominial ordinária (caso o imóvel pertença a condomínio);
- IPTU (caso convencionado entre as partes);
- Pequenos reparos de manutenção de uso.

4.2. São de responsabilidade do LOCADOR:
- Obrigações tributárias sobre o imóvel, salvo convenção diversa;
- Obras estruturais;
- Manutenção de vícios ocultos e defeitos pré-existentes.

**CLÁUSULA 5 – MULTA E JUROS POR ATRASO**

5.1. Em caso de inadimplência, aplicar-se-ão:
- Multa de [MULTA_ATRASO] sobre o valor da parcela vencida;
- Juros de mora de [JUROS_MORA] ao mês;
- Correção monetária pelo mesmo índice do reajuste contratual.

**CLÁUSULA 6 – GARANTIA LOCATÍCIA**

6.1. Esta locação será garantida por [TIPO_GARANTIA].

**CLÁUSULA 7 – FORO**

7.1. Fica eleito o foro da comarca de [COMARCA], para dirimir eventuais dúvidas ou litígios.

E por estarem assim justos e contratados, firmam o presente contrato.

[CIDADE], [DATA_ASSINATURA]

---

**ASSINATURAS DIGITAIS**

**LOCADOR(A):**
[ASSINATURA_LOCADOR]

**LOCATÁRIO(A):**
[ASSINATURA_LOCATARIO]

**TESTEMUNHA:**
[ASSINATURA_TESTEMUNHA]

`
  },
  {
    id: "commercial-cnpj-cnpj",
    name: "Locação Comercial - CNPJ x CNPJ",
    description: "Contrato entre pessoas jurídicas para imóvel comercial",
    type: "CTR",
    content: `**CONTRATO DE LOCAÇÃO COMERCIAL ENTRE PESSOAS JURÍDICAS**

Pelo presente instrumento particular de contrato de locação comercial, as partes abaixo identificadas:

**CORRETOR RESPONSÁVEL:**
Nome: [NOME_CORRETOR]
CRECI: [CRECI_CORRETOR]

**LOCADOR(A):**
Razão Social: [RAZAO_SOCIAL_LOCADOR]
CNPJ: [CNPJ_LOCADOR]
Endereço: [ENDERECO_LOCADOR]
Representante Legal: [REPRESENTANTE_LOCADOR]
Cargo: [CARGO_LOCADOR]
CPF: [CPF_REPRESENTANTE_LOCADOR]
E-mail: [EMAIL_LOCADOR]
Telefone: [TELEFONE_LOCADOR]

**LOCATÁRIO(A):**
Razão Social: [RAZAO_SOCIAL_LOCATARIO]
CNPJ: [CNPJ_LOCATARIO]
Endereço: [ENDERECO_LOCATARIO]
Representante Legal: [REPRESENTANTE_LOCATARIO]
Cargo: [CARGO_LOCATARIO]
CPF: [CPF_REPRESENTANTE_LOCATARIO]
E-mail: [EMAIL_LOCATARIO]
Telefone: [TELEFONE_LOCATARIO]

**CLÁUSULA 1 – OBJETO**

1.1. O LOCADOR dá em locação ao LOCATÁRIO o imóvel comercial localizado à [ENDERECO_IMOVEL], registrado sob matrícula nº [MATRICULA] no Cartório de Registro de Imóveis da comarca de [COMARCA].

1.2. O imóvel destina-se exclusivamente à instalação de [ATIVIDADE_COMERCIAL] da LOCATÁRIA, sendo vedado o uso para fins diversos ou residenciais sem autorização expressa do LOCADOR.

**CLÁUSULA 2 – PRAZO**

2.1. O prazo da locação será de [PRAZO_MESES] meses, iniciando-se em [DATA_INICIO] e encerrando-se em [DATA_FIM], podendo ser renovado mediante acordo entre as partes.

2.2. Caso o LOCATÁRIO permaneça no imóvel sem oposição após o término contratual, o contrato será automaticamente prorrogado por tempo indeterminado, regido pelas normas da Lei nº 8.245/91.

**CLÁUSULA 3 – VALOR DO ALUGUEL**

3.1. O aluguel mensal é de R$ [VALOR_ALUGUEL], com vencimento todo dia [DIA_VENCIMENTO] de cada mês.

3.2. O pagamento será realizado via Pix, boleto, transferência bancária ou pela plataforma MR3X, conforme opção do LOCADOR.

3.3. O valor será reajustado anualmente com base no índice [INDICE_REAJUSTE], conforme legislação vigente.

**CLÁUSULA 4 – ENCARGOS**

4.1. O LOCATÁRIO será responsável por:
- Contas de água, energia elétrica, gás, internet, limpeza e vigilância;
- IPTU e taxas municipais incidentes sobre o imóvel;
- Despesas condominiais ordinárias (se houver);
- Manutenção e reparos decorrentes do uso comum.

4.2. O LOCADOR será responsável por:
- Obrigações fiscais não transferíveis;
- Manutenção estrutural do imóvel e vícios ocultos;
- Regularização documental do imóvel perante órgãos públicos.

**CLÁUSULA 5 – GARANTIA LOCATÍCIA**

5.1. O presente contrato será garantido por meio de [TIPO_GARANTIA], conforme previsto nos artigos 37 a 40 da Lei nº 8.245/91.

**CLÁUSULA 6 – MULTAS E ATRASOS**

6.1. Em caso de inadimplência, será aplicada:
- Multa de [MULTA_ATRASO] sobre o valor da obrigação vencida;
- Juros de mora de [JUROS_MORA] ao mês;
- Correção monetária pelo índice pactuado no contrato.

**CLÁUSULA 7 – RESCISÃO**

7.1. A rescisão antecipada por qualquer das partes deverá ser comunicada com antecedência mínima de 90 (noventa) dias, sob pena de multa correspondente a 3 (três) aluguéis.

**CLÁUSULA 8 - FORO**

8.1. Fica eleito o foro da comarca de [COMARCA], com renúncia expressa a qualquer outro, por mais privilegiado que seja.

E por estarem assim justos e contratados, firmam o presente contrato.

[CIDADE], [DATA_ASSINATURA]

---

**ASSINATURAS DIGITAIS**

**LOCADOR(A):**
[ASSINATURA_LOCADOR]

**LOCATÁRIO(A):**
[ASSINATURA_LOCATARIO]

**TESTEMUNHA:**
[ASSINATURA_TESTEMUNHA]

`
  },
  {
    id: "platform-service",
    name: "Adesão ao Plano MR3X",
    description: "Contrato de adesão aos serviços da plataforma MR3X",
    type: "CTR",
    content: `**CONTRATO DE ADESÃO AO PLANO DE SERVIÇOS DA PLATAFORMA MR3X**

**MR3X TECNOLOGIA LTDA**
CNPJ: 27.960.990/0001-66

**1. DAS PARTES CONTRATANTES**

**CORRETOR RESPONSÁVEL:**
Nome: [NOME_CORRETOR]
CRECI: [CRECI_CORRETOR]

**CONTRATADA:**
MR3X TECNOLOGIA LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 27.960.990/0001-66, com sede em [ENDERECO_MR3X], doravante denominada "MR3X".

**CONTRATANTE:**
Nome/Razão Social: [NOME_CONTRATANTE]
CPF/CNPJ: [DOCUMENTO_CONTRATANTE]
Endereço: [ENDERECO_CONTRATANTE]
E-mail: [EMAIL_CONTRATANTE]
Telefone: [TELEFONE_CONTRATANTE]

**2. DO OBJETO**

2.1. O presente contrato tem por objeto a contratação de licença de uso, por adesão, de software do tipo SaaS (Software as a Service), denominado "MR3X", voltado à gestão de aluguéis, locações, cobranças, notificações e funcionalidades relacionadas.

2.2. A adesão se dará mediante seleção de um dos planos disponíveis: [PLANO_SELECIONADO]

**3. DOS PLANOS E VALORES**

3.1. Plano contratado: [PLANO_SELECIONADO]
3.2. Valor mensal: R$ [VALOR_PLANO]
3.3. Forma de pagamento: [FORMA_PAGAMENTO]
3.4. Dia de vencimento: [DIA_VENCIMENTO]

**4. DA VIGÊNCIA**

4.1. Este contrato tem início na data de aceite eletrônico e vigência de [PERIODO_VIGENCIA], renovando-se automaticamente.

4.2. O CONTRATANTE poderá solicitar o cancelamento a qualquer momento, por meio do painel da conta ou contato oficial.

**5. DOS DIREITOS E OBRIGAÇÕES**

5.1. A MR3X se compromete a:
- Manter a plataforma disponível e funcional;
- Garantir suporte técnico conforme o plano contratado;
- Proteger os dados do CONTRATANTE conforme a LGPD.

5.2. O CONTRATANTE se compromete a:
- Utilizar a plataforma de forma lícita e ética;
- Manter seus dados cadastrais atualizados;
- Realizar o pagamento pontual das mensalidades.

**6. DA PROTEÇÃO DE DADOS (LGPD)**

6.1. A MR3X atua como controladora dos dados cadastrais e de uso da plataforma, comprometendo-se a:
- Tratar os dados pessoais exclusivamente para as finalidades do serviço;
- Implementar medidas de segurança técnicas e administrativas;
- Não compartilhar dados com terceiros sem autorização, salvo obrigação legal.

**7. DAS PENALIDADES**

7.1. O inadimplemento superior a 30 (trinta) dias poderá resultar na suspensão temporária do acesso.

7.2. O uso indevido da plataforma poderá acarretar o cancelamento imediato do contrato.

**8. DO FORO**

8.1. Fica eleito o foro da comarca de [COMARCA], para dirimir eventuais dúvidas ou litígios decorrentes deste contrato.

E por estarem assim justos e contratados, as partes confirmam o aceite eletrônico deste instrumento.

Data de aceite: [DATA_ACEITE]

Confirmação eletrônica via plataforma MR3X.

---

**ASSINATURAS DIGITAIS**

**MR3X TECNOLOGIA LTDA:**
[ASSINATURA_IMOBILIARIA]

**CONTRATANTE:**
[ASSINATURA_LOCADOR]

**TESTEMUNHA:**
[ASSINATURA_TESTEMUNHA]

`
  },
  {
    id: "partnership-affiliate",
    name: "Parceria Comercial - Afiliados MR3X",
    description: "Contrato de parceria e comissionamento para afiliados",
    type: "CTR",
    content: `**CONTRATO DE PARCERIA COMERCIAL E COMISSIONAMENTO – AFILIADOS MR3X**

**CORRETOR RESPONSÁVEL:**
Nome: [NOME_CORRETOR]
CRECI: [CRECI_CORRETOR]

Pelo presente instrumento particular, de um lado:

**MR3X TECNOLOGIA LTDA**, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 27.960.990/0001-66, com sede em [ENDERECO_MR3X], doravante denominada "MR3X" ou "CONTRATANTE",

E, de outro lado:

**PARCEIRO COMERCIAL:**
Nome: [NOME_AFILIADO]
CPF: [CPF_AFILIADO]
Endereço: [ENDERECO_AFILIADO]
E-mail: [EMAIL_AFILIADO]
Telefone: [TELEFONE_AFILIADO]

**CLÁUSULA 1 – DO OBJETO**

1.1. O presente contrato tem por objeto a parceria comercial não exclusiva, pela qual o PARCEIRO atuará na promoção e indicação da plataforma MR3X, recebendo comissões sobre conversões de clientes assinantes captados por sua atuação direta.

1.2. A atuação do PARCEIRO será realizada de forma autônoma, eventual e sem subordinação, podendo ocorrer por:
- Abordagens diretas a proprietários, corretores e gestores
- Divulgação por redes sociais, e-mail marketing ou mídia paga (com autorização)
- Compartilhamento de links de afiliado fornecidos pela MR3X
- Participação em eventos, feiras ou apresentações autorizadas

**CLÁUSULA 2 – DAS OBRIGAÇÕES DO PARCEIRO**

2.1. O PARCEIRO compromete-se a:
- Divulgar a MR3X com ética e veracidade, respeitando os materiais e posicionamento institucional;
- Não prometer funcionalidades ou garantias que não estejam previstas nos termos da plataforma;
- Respeitar a legislação vigente, inclusive LGPD e normas de publicidade digital;
- Utilizar apenas os links, materiais e instruções fornecidas pela MR3X;
- Manter sigilo sobre informações confidenciais da empresa ou dos clientes.

**CLÁUSULA 3 – DAS OBRIGAÇÕES DA MR3X**

3.1. A MR3X compromete-se a:
- Disponibilizar ao PARCEIRO acesso a link exclusivo e painel de comissões;
- Realizar o pagamento das comissões devidas em até 15 dias úteis após a confirmação do pagamento do cliente indicado;
- Fornecer materiais oficiais, landing pages, treinamento e suporte operacional conforme disponibilidade.

**CLÁUSULA 4 – DA COMISSÃO E CONDIÇÕES**

4.1. A comissão padrão será de [PERCENTUAL_COMISSAO]% sobre o valor da 1ª mensalidade efetivamente paga por clientes novos indicados diretamente pelo PARCEIRO, via link rastreável ou código de indicação.

4.2. Só serão consideradas conversões válidas aquelas:
- Realizadas com o código/link exclusivo do PARCEIRO
- Confirmadas por pagamento efetivo da primeira mensalidade
- Não canceladas ou estornadas em até 7 dias da contratação

**CLÁUSULA 5 – DA NATUREZA DA RELAÇÃO**

5.1. As partes declaram expressamente que este contrato não estabelece vínculo empregatício, societário ou de representação legal.

5.2. O PARCEIRO atua de forma autônoma e sem subordinação direta, sendo responsável pelos seus custos, tributos e atividades de divulgação.

**CLÁUSULA 6 – VIGÊNCIA E RESCISÃO**

6.1. O presente contrato tem prazo de vigência de [PRAZO_MESES] meses, renovando-se automaticamente.

6.2. Qualquer das partes poderá rescindir este contrato mediante comunicação prévia de 30 dias.

**CLÁUSULA 7 – FORO**

7.1. Fica eleito o foro da comarca de [COMARCA] para dirimir eventuais conflitos.

E por estarem assim justos e contratados, firmam o presente instrumento.

[CIDADE], [DATA_ASSINATURA]

---

**ASSINATURAS DIGITAIS**

**MR3X TECNOLOGIA LTDA:**
[ASSINATURA_IMOBILIARIA]

**PARCEIRO COMERCIAL:**
[ASSINATURA_LOCADOR]

**TESTEMUNHA:**
[ASSINATURA_TESTEMUNHA]

`
  },
  {
    id: "condominium-admin",
    name: "Administração Condominial",
    description: "Contrato de prestação de serviços de administração condominial",
    type: "CTR",
    content: `**CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE ADMINISTRAÇÃO CONDOMINIAL**

**CORRETOR RESPONSÁVEL:**
Nome: [NOME_CORRETOR]
CRECI: [CRECI_CORRETOR]

Pelo presente instrumento particular, as partes:

**CONTRATANTE – CONDOMÍNIO RESIDENCIAL:**
Nome do Condomínio: [NOME_CONDOMINIO]
CNPJ: [CNPJ_CONDOMINIO]
Endereço: [ENDERECO_CONDOMINIO]
Representado por: [NOME_SINDICO]
CPF do Síndico: [CPF_SINDICO]
E-mail: [EMAIL_CONDOMINIO]
Telefone: [TELEFONE_CONDOMINIO]

**CONTRATADA – IMOBILIÁRIA ADMINISTRADORA:**
Razão Social: [RAZAO_SOCIAL_IMOBILIARIA]
CNPJ: [CNPJ_IMOBILIARIA]
CRECI Jurídico nº: [NUMERO_CRECI]
Endereço: [ENDERECO_IMOBILIARIA]
Representante Legal: [REPRESENTANTE_IMOBILIARIA]
CPF: [CPF_REPRESENTANTE_IMOBILIARIA]
E-mail: [EMAIL_IMOBILIARIA]
Telefone: [TELEFONE_IMOBILIARIA]

**CLÁUSULA 1 – OBJETO**

1.1. O presente contrato tem por objeto a prestação de serviços de administração condominial, com a finalidade de gerir as áreas comuns e a coletividade dos condôminos.

1.2. A CONTRATADA atuará como gestora administrativa e financeira, em cooperação com o síndico e o conselho fiscal, nos termos da convenção condominial, do regimento interno e da legislação vigente.

**CLÁUSULA 2 – PRAZO**

2.1. O prazo de vigência deste contrato será de [PRAZO_MESES] meses, com início em [DATA_INICIO] e término em [DATA_FIM], podendo ser renovado automaticamente por iguais e sucessivos períodos, salvo manifestação expressa em contrário por qualquer das partes com antecedência mínima de 30 (trinta) dias.

**CLÁUSULA 3 – REMUNERAÇÃO**

3.1. A CONTRATANTE pagará à CONTRATADA, a título de remuneração pelos serviços, o valor mensal de R$ [VALOR_MENSAL], reajustável anualmente pelo índice [INDICE_REAJUSTE].

3.2. O pagamento será efetuado até o dia [DIA_PAGAMENTO] de cada mês, mediante boleto, Pix, transferência ou por meio da plataforma MR3X.

**CLÁUSULA 4 – RESPONSABILIDADES DA CONTRATADA**

4.1. Compete à CONTRATADA:
- Realizar a cobrança das taxas condominiais dos condôminos;
- Elaborar e enviar balancetes mensais, relatórios de receitas e despesas;
- Emitir boletos de cobrança e recibos de quitação;
- Controlar inadimplência e propor ações extrajudiciais;
- Auxiliar o síndico na contratação e controle de prestadores de serviços;
- Manter e organizar os arquivos físicos e digitais do condomínio;
- Prestar contas regularmente com transparência;
- Atender condôminos por canais eletrônicos e presenciais.

**CLÁUSULA 5 – RESPONSABILIDADES DO CONTRATANTE**

5.1. Compete à CONTRATANTE:
- Fornecer os documentos e informações necessárias para a execução dos serviços;
- Informar decisões de assembleia e orientações da convenção;
- Comunicar formalmente qualquer irregularidade nos serviços prestados;
- Garantir acesso ao síndico e conselho fiscal para fins de acompanhamento da administração.

**CLÁUSULA 6 – PROTEÇÃO DE DADOS (LGPD)**

6.1. A CONTRATADA compromete-se a:
- Tratar os dados pessoais dos condôminos exclusivamente para fins de gestão condominial;
- Implementar medidas de segurança técnicas e administrativas adequadas;
- Não compartilhar dados com terceiros sem autorização expressa.

**CLÁUSULA 7 – RESCISÃO**

7.1. Qualquer das partes poderá rescindir este contrato mediante comunicação prévia de 30 (trinta) dias.

**CLÁUSULA 8 – FORO**

8.1. Fica eleito o foro da comarca de [COMARCA] para dirimir eventuais conflitos.

E por estarem assim justos e contratados, firmam o presente contrato.

[CIDADE], [DATA_ASSINATURA]

---

**ASSINATURAS DIGITAIS**

**CONTRATANTE (CONDOMÍNIO):**
[ASSINATURA_LOCADOR]

**CONTRATADA (IMOBILIÁRIA):**
[ASSINATURA_IMOBILIARIA]

**TESTEMUNHA:**
[ASSINATURA_TESTEMUNHA]

`
  }
];

export const getTemplateById = (id: string): ContractTemplate | undefined => {
  return contractTemplates.find(template => template.id === id);
};

export const getTemplatesByType = (type: 'CTR' | 'ACD' | 'VST'): ContractTemplate[] => {
  return contractTemplates.filter(template => template.type === type);
};
