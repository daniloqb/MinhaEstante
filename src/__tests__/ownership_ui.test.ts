import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { ReactElement, ReactNode } from 'react';
import { App } from '../App';
import { ManualBookScreen } from '../screens/ManualBookScreen';
import { BookEditModal } from '../components/BookEditModal';
import { BookDetailScreen } from '../screens/BookDetailScreen';
import { BookOwnershipToggle } from '../components/BookOwnershipToggle';
import { QuickActionModal } from '../components/QuickActionModal';
import { SearchScreen } from '../screens/SearchScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LandingHomeScreen } from '../screens/LandingHomeScreen';
import { HomeQuickLinks } from '../components/home/HomeQuickLinks';
import { NavigationBottomBar } from '../components/NavigationBottomBar';
import { BookCoverView } from '../components/BookCoverView';
import { PaperCard } from '../components/PaperCard';
import { BookStorage } from '../services/storage';
import { Book, ReadingStatus } from '../types/book';
import { DarkWalnutPalette as palette } from '../theme/woodTheme';
import { AVAILABLE_LOCALES, LocaleId } from '../i18n/types';
import { TRANSLATIONS } from '../i18n/translations';

// Renderização rasa: executa os componentes e seus callbacks reais com hooks isolados.
// Não simula DOM, navegação nativa nem o ciclo completo de renderização do React.
const hooks = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, locale: 'pt-BR' as LocaleId }));
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react') & { default: typeof React }>();
  const useState = (initial: any) => {
    const index = hooks.cursor++;
    if (!(index in hooks.slots)) hooks.slots[index] = typeof initial === 'function' ? initial() : initial;
    return [hooks.slots[index], (value: any) => {
      hooks.slots[index] = typeof value === 'function' ? value(hooks.slots[index]) : value;
    }];
  };
  const replacements = {
    useState,
    useRef: (initial: any) => useState(() => ({ current: initial }))[0],
    useEffect: () => {},
    useMemo: (factory: () => any) => factory(),
    useCallback: (callback: any) => callback,
  };
  return { ...actual, ...replacements, default: { ...actual.default, ...replacements } };
});
vi.mock('../i18n/I18nContext', async () => {
  const { TRANSLATIONS: translations } = await import('../i18n/translations');
  return { useI18n: () => ({ t: translations[hooks.locale] }) };
});

function mount(component: (props: any) => any, props: any, initialState: any[] = []) {
  hooks.slots = [...initialState];
  return () => { hooks.cursor = 0; return component(props); };
}
function elements(node: ReactNode): ReactElement<any>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<any>(node)) return [];
  return [node, ...elements((node as ReactElement<any>).props.children)];
}
function componentProps(tree: ReactNode, type: any): any {
  const element = elements(tree).find((e) => e.type === type);
  expect(element, `Componente ${type.name} disponível`).toBeDefined();
  return element!.props;
}
function content(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(content).join('');
  return React.isValidElement<any>(node) ? content((node as ReactElement<any>).props.children) : '';
}
function button(tree: ReactNode, label: string): any {
  const found = elements(tree).find((e) => e.type === 'button' && content(e).trim() === label);
  expect(found, `Botão ${label} disponível`).toBeDefined();
  return found!.props;
}
const sample: Book = {
  id: 1, uuid: 'synthetic-ui-book', origem: 'manual', titulo: 'Obra sintética', autores: ['Autor de teste'], generos: [],
  formato: 'ebook', formatos: ['ebook'], tenho_fisico: false, status_leitura: 'nenhum',
  nota: 8, anoLeitura: 2025, mesLeitura: 2, capaLocalPath: 'covers/synthetic.jpg',
  emprestimo: { nomePessoa: 'Pessoa de teste', dataEmprestimo: '2026-01-01', dataDevolucao: '2026-01-31' },
  dataCadastro: 1000, dataAtualizacao: 1000,
};

beforeEach(() => {
  hooks.locale = 'pt-BR';
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Cadastro, edição e detalhes: callbacks reais de posse e modalidades', () => {
  it.each([
    { tab: undefined, owned: false }, { tab: 'lido', owned: false }, { tab: 'quero_ler', owned: false },
    { tab: 'todos', owned: true }, { tab: 'meus_livros', owned: true },
  ])('novo cadastro na origem $tab inicia posse=$owned e permite alterá-la', ({ tab, owned }) => {
    const render = mount(ManualBookScreen, { palette, initialTab: tab, onSave: vi.fn(), onBack: vi.fn() });
    expect(componentProps(render(), BookOwnershipToggle).owned).toBe(owned);
    componentProps(render(), BookOwnershipToggle).onChange();
    expect(componentProps(render(), BookOwnershipToggle).owned).toBe(!owned);
  });
  for (const [name, component, bookProp] of [
    ['cadastro', ManualBookScreen, 'initialBook'], ['edição', BookEditModal, 'book'],
  ] as const) {
    it.each([true, false])(`${name}: alternar modalidades preserva posse=%s; salvar sem posse/status é permitido`, async (owned) => {
      const onSave = vi.fn();
      const render = mount(component, {
        palette, [bookProp]: { ...sample, tenho_fisico: owned }, isOpen: true,
        onSave, onDismiss: vi.fn(), onBack: vi.fn(), onDelete: vi.fn(),
      });
      expect(componentProps(render(), BookOwnershipToggle).owned).toBe(owned);
      button(render(), 'Físico').onClick();
      expect(componentProps(render(), BookOwnershipToggle).owned).toBe(owned);
      button(render(), 'Físico').onClick();
      button(render(), 'Audiolivro').onClick();
      expect(componentProps(render(), BookOwnershipToggle).owned).toBe(owned);
      if (owned) componentProps(render(), BookOwnershipToggle).onChange();
      expect(componentProps(render(), BookOwnershipToggle).owned).toBe(false);
      if (name === 'cadastro') {
        componentProps(render(), (await import('../components/WoodTopAppBar')).WoodTopAppBar).actions.props.onClick();
      } else {
        button(render(), 'Salvar na Estante').onClick();
      }
      await Promise.resolve();
      expect(onSave).toHaveBeenCalledOnce();
      expect(onSave.mock.calls[0][0]).toMatchObject({
        uuid: sample.uuid, formatos: ['ebook', 'audiolivro'], tenho_fisico: false, status_leitura: 'nenhum',
        emprestimo: sample.emprestimo, capaLocalPath: sample.capaLocalPath,
      });
    });
  }

  it.each(['lendo', 'abandonado'] as ReadingStatus[])('edição preserva o status existente %s', async (status) => {
    const onSave = vi.fn();
    const render = mount(BookEditModal, { palette, book: { ...sample, status_leitura: status }, isOpen: true, onSave, onDismiss: vi.fn() });
    componentProps(render(), BookOwnershipToggle).onChange();
    button(render(), 'Salvar na Estante').onClick();
    await Promise.resolve();
    expect(onSave.mock.calls[0][0]).toMatchObject({ status_leitura: status, tenho_fisico: true, formatos: ['ebook'] });
  });

  it('detalhes alternam formato sem posse e oferecem o controle para audiolivros', () => {
    const onUpdateBook = vi.fn();
    const render = mount(BookDetailScreen, {
      palette, book: { ...sample, formato: 'audiolivro', formatos: ['audiolivro'] }, onUpdateBook,
      onBack: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), onTogglePosse: vi.fn(), onSetStatusLeitura: vi.fn(),
    });
    expect(componentProps(render(), BookOwnershipToggle).owned).toBe(false);
    const formatButton = elements(render()).find((e) => e.type === 'button' && content(e).trim() === 'Livro Físico');
    expect(formatButton).toBeDefined();
    formatButton!.props.onClick();
    expect(onUpdateBook.mock.calls[0][0]).toMatchObject({ formatos: ['audiolivro', 'fisico'], tenho_fisico: false });
  });

  it.each(AVAILABLE_LOCALES)('controle de posse traduzido em $id', ({ id }) => {
    hooks.locale = id;
    const render = mount(BookOwnershipToggle, { palette, owned: true, onChange: vi.fn() });
    const toggle = elements(render()).find((e) => e.props.role === 'switch')!;
    expect(toggle.props['aria-label']).toBe(TRANSLATIONS[id].ownership.label);
    expect(toggle.props['aria-checked']).toBe(true);
    expect(content(render())).toContain(TRANSLATIONS[id].ownership.description);
  });
});

describe('Integração dos callbacks do App, Explorar e contadores', () => {
  function app(books = [sample]) {
    const save = vi.spyOn(BookStorage, 'saveBookToDatabase').mockImplementation(async (book) => ({ ...book, id: book.id || 42 }));
    const remove = vi.spyOn(BookStorage, 'deleteBookFromDatabase');
    // Estado inicial da biblioteca e prontidão do banco; efeitos nativos não são executados.
    const render = mount(App, {}, [books, true]);
    return { render, save, remove };
  }

  it('remover posse não exclui registro sem status nem muda metadados', async () => {
    const owned = { ...sample, tenho_fisico: true };
    const { render, save, remove } = app([owned]);
    componentProps(render(), QuickActionModal).onTogglePosse(owned);
    await Promise.resolve();
    expect(save.mock.calls[0][0]).toMatchObject({ ...owned, tenho_fisico: false, dataAtualizacao: expect.any(Number) });
    expect(remove).not.toHaveBeenCalled();
    expect(componentProps(render(), LandingHomeScreen).books).toHaveLength(1);
  });

  it.each(['lido', 'quero_ler', 'lendo', 'abandonado', 'nenhum'] as ReadingStatus[])('status %s mantém posse e modalidades', async (status) => {
    const { render, save } = app();
    await componentProps(render(), QuickActionModal).onSetStatusLeitura(sample, status);
    expect(save.mock.calls[0][0]).toMatchObject({ tenho_fisico: false, formatos: ['ebook'], status_leitura: status });
  });

  it('ação rápida alterna apenas uma modalidade e mantém as demais', async () => {
    const { render, save } = app();
    await componentProps(render(), QuickActionModal).onToggleFormato(sample, 'audiolivro');
    expect(save.mock.calls[0][0]).toMatchObject({ formatos: ['ebook', 'audiolivro'], tenho_fisico: false });
  });

  it('Explorar preserva posse em registros existentes ao trocar modalidades ou registrar leitura', async () => {
    const { render, save } = app();
    componentProps(render(), LandingHomeScreen).onNavigateToTab('BUSCAR');
    componentProps(render(), SearchScreen).onSelectBookToAdd(sample, ['ebook', 'audiolivro']);
    await Promise.resolve();
    expect(save.mock.calls[0][0]).toMatchObject({ tenho_fisico: false, formatos: ['ebook', 'audiolivro'] });
    componentProps(render(), SearchScreen).onSelectBookToAdd(sample, ['ebook'], 'quero_ler');
    await Promise.resolve();
    expect(save.mock.calls[1][0]).toMatchObject({ tenho_fisico: false, status_leitura: 'quero_ler' });
  });

  it('alterar apenas modalidade de livro Lido não preenche datas ausentes', async () => {
    const book = { ...sample, status_leitura: 'lido' as const, anoLeitura: null, mesLeitura: null };
    const { render, save } = app([book]);
    componentProps(render(), LandingHomeScreen).onNavigateToTab('BUSCAR');
    componentProps(render(), SearchScreen).onSelectBookToAdd(book, ['ebook', 'audiolivro']);
    await Promise.resolve();
    expect(save.mock.calls[0][0]).toMatchObject({ status_leitura: 'lido', anoLeitura: null, mesLeitura: null, tenho_fisico: false });
  });

  it('prévia externa exige confirmação editável ao marcar posse ou leitura', async () => {
    const { render, save } = app([]);
    componentProps(render(), LandingHomeScreen).onSelectExternalBook(sample);
    componentProps(render(), BookDetailScreen).onTogglePosse();
    expect(componentProps(render(), BookEditModal).book.tenho_fisico).toBe(true);
    await componentProps(render(), BookDetailScreen).onSetStatusLeitura('quero_ler');
    expect(componentProps(render(), BookEditModal).book).toMatchObject({ tenho_fisico: false, status_leitura: 'quero_ler' });
    expect(save).not.toHaveBeenCalled();
  });

  it('cartão de Explorar separa seleção de modalidade, coleção e registro de leitura', () => {
    const onSelectBookToAdd = vi.fn();
    const onSelectBookDetail = vi.fn();
    const render = mount(SearchScreen, {
      palette, searchQuery: 'Obra', results: [sample], userBooks: [], isLoading: false, errorMessage: null,
      onQueryChange: vi.fn(), onSearch: vi.fn(), onSelectBookToAdd, onSelectBookDetail, onOpenManualRegister: vi.fn(),
    });
    const click = { stopPropagation: vi.fn() };
    button(render(), 'Audiolivro').onClick(click);
    expect(onSelectBookToAdd).not.toHaveBeenCalled();
    const card = elements(render()).find((e) => e.type === PaperCard && e.props.onClick)!;
    card.props.onClick();
    expect(onSelectBookDetail.mock.calls[0][0]).toMatchObject({ formatos: ['ebook', 'audiolivro'], tenho_fisico: false });
    button(render(), TRANSLATIONS['pt-BR'].ownership.add).onClick(click);
    expect(onSelectBookToAdd.mock.calls[0]).toEqual([sample, ['ebook', 'audiolivro'], undefined, true]);
    button(render(), 'Quero Ler').onClick(click);
    expect(onSelectBookToAdd.mock.calls[1]).toEqual([sample, ['ebook', 'audiolivro'], 'quero_ler']);
  });

  it.each([
    { status: 'nenhum', owned: true }, { status: 'lido', owned: undefined }, { status: 'quero_ler', owned: undefined },
  ] as const)('nova inclusão $status / posse $owned permite confirmar a escolha no editor', ({ status, owned }) => {
    const { render, save } = app([]);
    componentProps(render(), LandingHomeScreen).onNavigateToTab('BUSCAR');
    componentProps(render(), SearchScreen).onSelectBookToAdd(sample, ['audiolivro'], status, owned);
    const pending = componentProps(render(), BookEditModal).book;
    expect(pending).toMatchObject({ id: 0, formatos: ['audiolivro'], tenho_fisico: owned === true, status_leitura: status });
    expect(save).not.toHaveBeenCalled();
  });

  it('Home, navegação, aba e filtro físico concordam sobre posse e modalidades', () => {
    const books: Book[] = [
      sample, { ...sample, id: 2, tenho_fisico: true },
      { ...sample, id: 3, tenho_fisico: true, formato: 'audiolivro', formatos: ['audiolivro'] },
    ];
    const { render } = app(books);
    const homeProps = componentProps(render(), LandingHomeScreen);
    expect(componentProps(render(), NavigationBottomBar).totalCount).toBe(2);
    homeProps.onOpenShelfWithStatus('todos');
    expect(componentProps(render(), HomeScreen).books.map((b: Book) => b.id)).toEqual([2, 3]);
    componentProps(render(), HomeScreen).onFormatFilterChange('fisico');
    expect(componentProps(render(), HomeScreen).books).toHaveLength(0);
    const renderLanding = mount(LandingHomeScreen, homeProps);
    expect(componentProps(renderLanding(), HomeQuickLinks).counts.meusLivros).toBe(2);
  });

  it('capa de e-book possuído não exibe selo de modalidade física', () => {
    const render = mount(BookCoverView, { palette, book: { ...sample, tenho_fisico: true }, title: sample.titulo });
    expect(content(render())).not.toContain('Físico');
    expect(content(render())).toContain('E-book');
  });
});
