package com.example.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.components.PaperCard
import com.example.ui.components.WoodBackground
import com.example.ui.components.WoodTopAppBar
import com.example.ui.theme.CormorantFontFamily
import com.example.ui.theme.LocalWoodPalette
import com.example.ui.viewmodel.GroupByMode
import com.example.ui.viewmodel.ViewMode
import kotlinx.coroutines.launch

@Composable
fun SettingsBackupScreen(
    currentViewMode: ViewMode,
    onViewModeChange: (ViewMode) -> Unit,
    currentGroupBy: GroupByMode,
    onGroupByChange: (GroupByMode) -> Unit,
    isLightOak: Boolean,
    onToggleTheme: () -> Unit,
    apiKey: String,
    onApiKeyChange: (String) -> Unit,
    onExportCsv: suspend () -> String,
    onExportJson: suspend () -> String,
    onImportCsv: suspend (String) -> Int,
    onImportJson: suspend (String) -> Int
) {
    val palette = LocalWoodPalette.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var showImportDialog by remember { mutableStateOf<String?>(null) } // "csv" or "json"
    var importText by remember { mutableStateOf("") }
    var isOperating by remember { mutableStateOf(false) }

    fun shareText(content: String, title: String) {
        val sendIntent = Intent().apply {
            action = Intent.ACTION_SEND
            putExtra(Intent.EXTRA_TEXT, content)
            type = "text/plain"
        }
        val shareIntent = Intent.createChooser(sendIntent, title)
        context.startActivity(shareIntent)
    }

    if (showImportDialog != null) {
        AlertDialog(
            onDismissRequest = {
                showImportDialog = null
                importText = ""
            },
            containerColor = palette.paperSurface,
            title = {
                Text(
                    text = if (showImportDialog == "csv") "Importar Livros via CSV" else "Restaurar Backup JSON",
                    fontFamily = CormorantFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    color = palette.textOnPaper
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = if (showImportDialog == "csv") {
                            "Cole o conteúdo do CSV abaixo. As colunas suportadas incluem: titulo, autor, ano_leitura, mes_leitura, nota, paginas, status."
                        } else {
                            "Cole o JSON completo exportado anteriormente:"
                        },
                        fontSize = 13.sp,
                        color = palette.textSecondaryOnPaper
                    )

                    OutlinedTextField(
                        value = importText,
                        onValueChange = { importText = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(160.dp)
                            .testTag("input_import_content"),
                        placeholder = {
                            Text(
                                if (showImportDialog == "csv") "titulo,autor,ano,mes,nota\nDom Casmurro,Machado de Assis,2026,5,10" else "[\n  {\n    \"titulo\": \"...\"\n  }\n]"
                            )
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = palette.woodBorder,
                            unfocusedBorderColor = palette.woodBorder.copy(alpha = 0.5f),
                            focusedContainerColor = palette.paperSurfaceElevated,
                            unfocusedContainerColor = palette.paperSurfaceElevated
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val textToImport = importText
                        val type = showImportDialog
                        showImportDialog = null
                        importText = ""
                        scope.launch {
                            isOperating = true
                            try {
                                val count = if (type == "csv") {
                                    onImportCsv(textToImport)
                                } else {
                                    onImportJson(textToImport)
                                }
                                Toast.makeText(context, "$count livros importados com sucesso!", Toast.LENGTH_LONG).show()
                            } catch (e: Exception) {
                                Toast.makeText(context, "Erro ao importar: ${e.message}", Toast.LENGTH_LONG).show()
                            } finally {
                                isOperating = false
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = palette.goldPrimary,
                        contentColor = palette.textOnGold
                    ),
                    modifier = Modifier.testTag("btn_confirmar_importacao")
                ) {
                    Text("Importar")
                }
            },
            dismissButton = {
                TextButton(onClick = {
                    showImportDialog = null
                    importText = ""
                }) {
                    Text("Cancelar", color = palette.textSecondaryOnPaper)
                }
            }
        )
    }

    WoodBackground {
        Column(modifier = Modifier.fillMaxSize()) {
            WoodTopAppBar(title = "Configurações & Backup")

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Tema da Biblioteca
                PaperCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Identidade Visual & Tema",
                        fontFamily = CormorantFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        color = palette.textOnPaper
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = if (isLightOak) "Carvalho Claro (Light Oak)" else "Nogueira Escura Clássica",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 15.sp,
                                color = palette.textOnPaper
                            )
                            Text(
                                text = if (isLightOak) "Madeira suave com iluminação dourada" else "Madeira nobre escura de biblioteca clássica",
                                fontSize = 12.sp,
                                color = palette.textSecondaryOnPaper
                            )
                        }

                        Switch(
                            checked = isLightOak,
                            onCheckedChange = { onToggleTheme() },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = palette.goldPrimary,
                                checkedTrackColor = palette.woodBorder
                            ),
                            modifier = Modifier.testTag("switch_tema")
                        )
                    }
                }

                // Preferências de Visualização da Estante
                PaperCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Preferências da Estante",
                        fontFamily = CormorantFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        color = palette.textOnPaper
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = "Modo de Exibição Padrão:",
                        fontWeight = FontWeight.Medium,
                        fontSize = 14.sp,
                        color = palette.textOnPaper
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        FilterChip(
                            selected = currentViewMode == ViewMode.CAPAS,
                            onClick = { onViewModeChange(ViewMode.CAPAS) },
                            label = { Text("Prateleiras de Capas") },
                            modifier = Modifier.weight(1f),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = palette.goldPrimary,
                                selectedLabelColor = palette.textOnGold,
                                containerColor = Color.Transparent,
                                labelColor = palette.textOnPaper
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                enabled = true,
                                selected = currentViewMode == ViewMode.CAPAS,
                                borderColor = palette.woodBorder
                            )
                        )
                        FilterChip(
                            selected = currentViewMode == ViewMode.LISTA,
                            onClick = { onViewModeChange(ViewMode.LISTA) },
                            label = { Text("Lista de Cartões") },
                            modifier = Modifier.weight(1f),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = palette.goldPrimary,
                                selectedLabelColor = palette.textOnGold,
                                containerColor = Color.Transparent,
                                labelColor = palette.textOnPaper
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                enabled = true,
                                selected = currentViewMode == ViewMode.LISTA,
                                borderColor = palette.woodBorder
                            )
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = "Agrupamento das Prateleiras:",
                        fontWeight = FontWeight.Medium,
                        fontSize = 14.sp,
                        color = palette.textOnPaper
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        GroupByMode.entries.forEach { mode ->
                            val label = when (mode) {
                                GroupByMode.ANO -> "Ano"
                                GroupByMode.AUTOR -> "Autor"
                                GroupByMode.GENERO -> "Gênero"
                            }
                            FilterChip(
                                selected = currentGroupBy == mode,
                                onClick = { onGroupByChange(mode) },
                                label = { Text(label) },
                                modifier = Modifier.weight(1f),
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = palette.woodBorder,
                                    selectedLabelColor = Color.White,
                                    containerColor = Color.Transparent,
                                    labelColor = palette.textOnPaper
                                ),
                                border = FilterChipDefaults.filterChipBorder(
                                    enabled = true,
                                    selected = currentGroupBy == mode,
                                    borderColor = palette.woodBorder
                                )
                            )
                        }
                    }
                }

                // Google Books API Key
                PaperCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Chave da API Google Books (Opcional)",
                        fontFamily = CormorantFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        color = palette.textOnPaper
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "A busca já funciona gratuitamente sem chave. Adicione sua chave pessoal caso atinja o limite público.",
                        fontSize = 12.sp,
                        color = palette.textSecondaryOnPaper
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = apiKey,
                        onValueChange = onApiKeyChange,
                        placeholder = { Text("AIzaSy...") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().testTag("input_api_key"),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = palette.woodBorder,
                            unfocusedBorderColor = palette.woodBorder.copy(alpha = 0.5f),
                            focusedContainerColor = palette.paperSurfaceElevated,
                            unfocusedContainerColor = palette.paperSurfaceElevated
                        )
                    )
                }

                // Importação e Exportação (Backup)
                PaperCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Backup e Sincronização Local",
                        fontFamily = CormorantFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        color = palette.textOnPaper
                    )

                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Exporte todos os seus livros em CSV (compatível com Excel e Google Sheets) ou JSON completo para restaurar quando quiser.",
                        fontSize = 12.sp,
                        color = palette.textSecondaryOnPaper
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    // Botões de Exportação
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = {
                                scope.launch {
                                    val csv = onExportCsv()
                                    shareText(csv, "Minha Estante - Livros (CSV)")
                                }
                            },
                            modifier = Modifier.weight(1f).testTag("btn_exportar_csv"),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = palette.woodBorder,
                                contentColor = Color.White
                            )
                        ) {
                            Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Exportar CSV")
                        }

                        Button(
                            onClick = {
                                scope.launch {
                                    val json = onExportJson()
                                    shareText(json, "Minha Estante - Backup (JSON)")
                                }
                            },
                            modifier = Modifier.weight(1f).testTag("btn_exportar_json"),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = palette.woodBorder,
                                contentColor = Color.White
                            )
                        ) {
                            Icon(Icons.Default.Download, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Backup JSON")
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Botões de Importação
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = { showImportDialog = "csv" },
                            modifier = Modifier.weight(1f).testTag("btn_abrir_importar_csv"),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = palette.textOnPaper),
                            border = androidx.compose.foundation.BorderStroke(1.dp, palette.woodBorder)
                        ) {
                            Icon(Icons.Default.Upload, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Importar CSV")
                        }

                        OutlinedButton(
                            onClick = { showImportDialog = "json" },
                            modifier = Modifier.weight(1f).testTag("btn_abrir_restaurar_json"),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = palette.textOnPaper),
                            border = androidx.compose.foundation.BorderStroke(1.dp, palette.woodBorder)
                        ) {
                            Icon(Icons.Default.Restore, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Restaurar JSON")
                        }
                    }
                }

                // Sobre o App
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "Minha Estante",
                            fontFamily = CormorantFontFamily,
                            fontWeight = FontWeight.Bold,
                            fontSize = 20.sp,
                            color = palette.goldPrimary
                        )
                        Text(
                            text = "Registro clássico de leituras · 100% Offline & Seguro",
                            fontSize = 12.sp,
                            color = palette.textSecondaryOnWood
                        )
                    }
                }
            }
        }
    }
}
