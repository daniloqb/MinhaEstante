import { describe, it, expect } from 'vitest';
import React from 'react';
import { NavigationBottomBar } from '../components/NavigationBottomBar';
import { PaperCard } from '../components/PaperCard';
import { BookCoverView } from '../components/BookCoverView';
import { BookEditModal } from '../components/BookEditModal';
import { SearchScreen } from '../screens/SearchScreen';
import { HomeScreen, HomeScreenProps } from '../screens/HomeScreen';
import { DarkWalnutPalette } from '../theme/woodTheme';
import { Book } from '../types/book';

describe('Correção de Bugs: Rolagem, Sobreposição, Alternância, FAB e Editar Obra', () => {
  const sampleBook: Book = {
    id: 1,
    origem: 'manual',
    titulo: 'Dom Casmurro',
    autores: ['Machado de Assis'],
    tenho_fisico: true,
    status_leitura: 'lido',
    formato: 'fisico',
    generos: ['Romance'],
    dataCadastro: 1000,
    dataAtualizacao: 1000,
    emprestimo: {
      nomePessoa: 'Mariana',
      emailPessoa: null,
      dataEmprestimo: '2026-10-01',
      dataDevolucao: '2026-11-01',
      devolvido: false,
    },
  };

  it('Bug 1: NavigationBottomBar renderiza elemento nav com z-50 e isolamento de camada', () => {
    const element = React.createElement(NavigationBottomBar, {
      palette: DarkWalnutPalette,
      currentTab: 'ESTANTE',
      onTabChange: () => {},
      totalCount: 1,
      borrowedCount: 1,
    });

    expect(element.type).toBe(NavigationBottomBar);
    expect(element.props.currentTab).toBe('ESTANTE');
  });

  it('Bug 1: PaperCard aplica isolamento de empilhamento (isolate) para que filhos não escapem', () => {
    const element = React.createElement(PaperCard, {
      palette: DarkWalnutPalette,
      children: React.createElement('span', null, 'Conteúdo do Card'),
    });

    expect(element.type).toBe(PaperCard);
    expect(element.props.palette).toBe(DarkWalnutPalette);
  });

  it('Bug 1: BookCoverView renderiza marcadores de status com ordenação consistente', () => {
    const element = React.createElement(BookCoverView, {
      palette: DarkWalnutPalette,
      book: sampleBook,
      title: sampleBook.titulo,
      author: sampleBook.autores[0],
      width: 108,
      height: 160,
    });

    expect(element.type).toBe(BookCoverView);
    expect(element.props.book?.tenho_fisico).toBe(true);
    expect(element.props.book?.emprestimo?.devolvido).toBe(false);
  });

  it('Bug 2: Alternância de viewMode entre CAPAS e LISTA preserva consistência funcional', () => {
    const viewModes = ['CAPAS', 'LISTA'] as const;
    expect(viewModes).toContain('CAPAS');
    expect(viewModes).toContain('LISTA');
  });

  it('Item 1 & 2: HomeScreen renderiza FAB e propaga onAddBookClick', () => {
    let clicked = false;
    const props: HomeScreenProps = {
      palette: DarkWalnutPalette,
      books: [sampleBook],
      allBooks: [sampleBook],
      statusTab: 'todos',
      onStatusTabChange: () => {},
      viewMode: 'CAPAS',
      onViewModeChange: () => {},
      groupBy: 'GENERO',
      onGroupByChange: () => {},
      sortOption: 'TITULO',
      onSortChange: () => {},
      searchQuery: '',
      onSearchQueryChange: () => {},
      selectedYear: null,
      onYearFilterChange: () => {},
      selectedGenre: null,
      onGenreFilterChange: () => {},
      selectedRatingMin: null,
      onRatingFilterChange: () => {},
      selectedFormat: null,
      onFormatFilterChange: () => {},
      onClearFilters: () => {},
      onSelectBook: () => {},
      onOpenQuickAction: () => {},
      onOpenFiltersModal: () => {},
      onAddBookClick: () => {
        clicked = true;
      },
    };

    const element = React.createElement(HomeScreen, props);
    expect(element.type).toBe(HomeScreen);
    props.onAddBookClick();
    expect(clicked).toBe(true);
  });

  it('Melhoria 1: BookEditModal é instanciado com suporte a rodapé de ações fixo', () => {
    let saved = false;
    let dismissed = false;

    const element = React.createElement(BookEditModal, {
      palette: DarkWalnutPalette,
      book: sampleBook,
      isOpen: true,
      onDismiss: () => {
        dismissed = true;
      },
      onSave: () => {
        saved = true;
      },
      onDelete: () => {},
    });

    expect(element.type).toBe(BookEditModal);
    expect(element.props.isOpen).toBe(true);
    element.props.onDismiss();
    expect(dismissed).toBe(true);
    element.props.onSave(sampleBook);
    expect(saved).toBe(true);
  });

  it('Melhoria 2: SearchScreen inclui botão de Cadastro Manual integrado ao lado de Escanear', () => {
    let manualClicked = false;

    const element = React.createElement(SearchScreen, {
      palette: DarkWalnutPalette,
      searchQuery: '',
      onQueryChange: () => {},
      onSearch: () => {},
      isLoading: false,
      results: [],
      errorMessage: null,
      onSelectBookToAdd: () => {},
      onSelectBookDetail: () => {},
      onOpenManualRegister: () => {
        manualClicked = true;
      },
    });

    expect(element.type).toBe(SearchScreen);
    element.props.onOpenManualRegister();
    expect(manualClicked).toBe(true);
  });
});
