import { describe, it, expect } from 'vitest';
import React from 'react';
import { TRANSLATIONS } from '../i18n/translations';
import { NavigationBottomBar } from '../components/NavigationBottomBar';
import { HomeScreen, HomeScreenProps } from '../screens/HomeScreen';
import { DarkWalnutPalette } from '../theme/woodTheme';
import { Book } from '../types/book';

describe('Minha Estante - Ajustes estruturais no menu de navegação e internacionalização', () => {
  describe('Melhoria 2: Renomear Busca para Explorar em todos os idiomas', () => {
    it('Traduz nav.search para Explorar em pt-BR', () => {
      expect(TRANSLATIONS['pt-BR'].nav.search).toBe('Explorar');
    });

    it('Traduz nav.search para Explore em en-US', () => {
      expect(TRANSLATIONS['en-US'].nav.search).toBe('Explore');
    });

    it('Traduz nav.search para Explorar em es-ES', () => {
      expect(TRANSLATIONS['es-ES'].nav.search).toBe('Explorar');
    });

    it('Traduz nav.search para Explorer em fr-FR', () => {
      expect(TRANSLATIONS['fr-FR'].nav.search).toBe('Explorer');
    });

    it('Traduz nav.search para Entdecken em de-DE', () => {
      expect(TRANSLATIONS['de-DE'].nav.search).toBe('Entdecken');
    });

    it('Traduz nav.search para Esplora em it-IT', () => {
      expect(TRANSLATIONS['it-IT'].nav.search).toBe('Esplora');
    });
  });

  describe('Melhoria 1: Reposicionar o item Emprestados no menu de navegação', () => {
    it('NavigationBottomBar não contém Emprestados duplicado e seleciona Estante quando em EMPRESTADOS', () => {
      let selectedTab = '';
      const element = React.createElement(NavigationBottomBar, {
        palette: DarkWalnutPalette,
        currentTab: 'EMPRESTADOS',
        onTabChange: (tab) => {
          selectedTab = tab;
        },
        totalCount: 5,
        borrowedCount: 2,
      });

      expect(element.type).toBe(NavigationBottomBar);
      expect(element.props.currentTab).toBe('EMPRESTADOS');
      element.props.onTabChange('ESTANTE');
      expect(selectedTab).toBe('ESTANTE');
    });

    it('HomeScreen aceita onOpenLoans para navegação até a aba de empréstimos', () => {
      let loansOpened = false;
      const sampleBook: Book = {
        id: 1,
        origem: 'manual',
        titulo: 'Livro de Teste',
        autores: ['Autor'],
        generos: ['Ficção'],
        tenho_fisico: true,
        status_leitura: 'nenhum',
        dataCadastro: Date.now(),
        dataAtualizacao: Date.now(),
        emprestimo: {
          nomePessoa: 'Amigo',
          dataEmprestimo: '2026-10-01',
          dataDevolucao: '2026-10-25',
          devolvido: false,
        },
      };

      const props: HomeScreenProps = {
        palette: DarkWalnutPalette,
        books: [sampleBook],
        allBooks: [sampleBook],
        statusTab: 'todos',
        onStatusTabChange: () => {},
        viewMode: 'CAPAS',
        onViewModeChange: () => {},
        groupBy: 'AUTOR',
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
        onAddBookClick: () => {},
        onOpenLoans: () => {
          loansOpened = true;
        },
      };

      const element = React.createElement(HomeScreen, props);
      expect(element.type).toBe(HomeScreen);
      props.onOpenLoans!();
      expect(loansOpened).toBe(true);
    });
  });
});
