import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SIN_RUEDA } from '../interceptors/loading.interceptor';
import {
  Beneficiario,
  CajaResumen,
  ConceptoCaja,
  CrearGiro,
  FiltroHistorial,
  Giro,
  GiroResumen,
  GuardarBeneficiario,
  HistorialCaja,
  MovimientoCaja,
  OrdenCompraPendientePago,
  PasoPagoCaja,
  ResultadoArqueo
} from '../models/caja.model';

/** Cajas menores de efectivo (2026-11-27). */
@Injectable({ providedIn: 'root' })
export class CajaService {
  private readonly baseUrl = `${environment.apiUrl}/cajas`;
  private readonly sinRueda = { context: new HttpContext().set(SIN_RUEDA, true) };

  constructor(private readonly http: HttpClient) {}

  listar(): Observable<CajaResumen[]> {
    return this.http.get<CajaResumen[]>(this.baseUrl);
  }

  obtener(cajaId: number): Observable<CajaResumen> {
    return this.http.get<CajaResumen>(`${this.baseUrl}/${cajaId}`);
  }

  actualizar(cajaId: number, tope: number, saldoMinimoAlerta: number): Observable<CajaResumen> {
    return this.http.put<CajaResumen>(`${this.baseUrl}/${cajaId}`, { tope, saldoMinimoAlerta });
  }

  pasosPago(cajaId: number): Observable<PasoPagoCaja[]> {
    return this.http.get<PasoPagoCaja[]>(`${this.baseUrl}/${cajaId}/pasos-pago`);
  }

  marcarPasoPago(cajaId: number, pasoId: number, requiereGiroCaja: boolean): Observable<PasoPagoCaja> {
    return this.http.put<PasoPagoCaja>(`${this.baseUrl}/${cajaId}/pasos-pago/${pasoId}`, { requiereGiroCaja });
  }

  conceptos(cajaId: number): Observable<ConceptoCaja[]> {
    return this.http.get<ConceptoCaja[]>(`${this.baseUrl}/${cajaId}/conceptos`);
  }

  crearConcepto(cajaId: number, nombre: string): Observable<ConceptoCaja> {
    return this.http.post<ConceptoCaja>(`${this.baseUrl}/${cajaId}/conceptos`, { nombre, activo: true });
  }

  actualizarConcepto(cajaId: number, concepto: ConceptoCaja): Observable<ConceptoCaja> {
    return this.http.put<ConceptoCaja>(`${this.baseUrl}/${cajaId}/conceptos/${concepto.id}`, { nombre: concepto.nombre, activo: concepto.activo });
  }

  buscarBeneficiarios(texto: string): Observable<Beneficiario[]> {
    return this.http.get<Beneficiario[]>(`${this.baseUrl}/beneficiarios`, { params: { texto }, ...this.sinRueda });
  }

  crearBeneficiario(dto: GuardarBeneficiario): Observable<Beneficiario> {
    return this.http.post<Beneficiario>(`${this.baseUrl}/beneficiarios`, dto);
  }

  actualizarBeneficiario(id: number, dto: GuardarBeneficiario): Observable<Beneficiario> {
    return this.http.put<Beneficiario>(`${this.baseUrl}/beneficiarios/${id}`, dto);
  }

  recargar(cajaId: number, valor: number, nota: string | null): Observable<MovimientoCaja> {
    return this.http.post<MovimientoCaja>(`${this.baseUrl}/${cajaId}/recargas`, { valor, nota });
  }

  arqueo(cajaId: number, efectivoContado: number, motivo: string | null): Observable<ResultadoArqueo> {
    return this.http.post<ResultadoArqueo>(`${this.baseUrl}/${cajaId}/arqueos`, { efectivoContado, motivo });
  }

  anularMovimiento(cajaId: number, movimientoId: number, motivo: string): Observable<MovimientoCaja> {
    return this.http.post<MovimientoCaja>(`${this.baseUrl}/${cajaId}/movimientos/${movimientoId}/anular`, { motivo });
  }

  historial(cajaId: number, filtro: FiltroHistorial): Observable<HistorialCaja> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      if (valor !== null && valor !== undefined && valor !== '') params = params.set(clave, String(valor));
    }
    return this.http.get<HistorialCaja>(`${this.baseUrl}/${cajaId}/movimientos`, { params });
  }

  ordenesPendientes(cajaId: number): Observable<OrdenCompraPendientePago[]> {
    return this.http.get<OrdenCompraPendientePago[]>(`${this.baseUrl}/${cajaId}/ordenes-pendientes`);
  }

  giros(cajaId: number, soloPendientes: boolean): Observable<GiroResumen[]> {
    return this.http.get<GiroResumen[]>(`${this.baseUrl}/${cajaId}/giros`, { params: { soloPendientes } });
  }

  giro(cajaId: number, giroId: number): Observable<Giro> {
    return this.http.get<Giro>(`${this.baseUrl}/${cajaId}/giros/${giroId}`);
  }

  crearGiro(cajaId: number, dto: CrearGiro): Observable<Giro> {
    return this.http.post<Giro>(`${this.baseUrl}/${cajaId}/giros`, dto);
  }

  legalizar(cajaId: number, giroId: number, valorGastado: number, nota: string | null): Observable<Giro> {
    return this.http.post<Giro>(`${this.baseUrl}/${cajaId}/giros/${giroId}/legalizar`, { valorGastado, nota });
  }

  recibirVuelta(cajaId: number, giroId: number, valor: number, nota: string | null): Observable<Giro> {
    return this.http.post<Giro>(`${this.baseUrl}/${cajaId}/giros/${giroId}/vueltas`, { valor, nota });
  }

  anularGiro(cajaId: number, giroId: number, motivo: string): Observable<Giro> {
    return this.http.post<Giro>(`${this.baseUrl}/${cajaId}/giros/${giroId}/anular`, { motivo });
  }

  subirSoporte(cajaId: number, giroId: number, archivo: File): Observable<Giro> {
    const form = new FormData();
    form.append('archivo', archivo, archivo.name);
    return this.http.post<Giro>(`${this.baseUrl}/${cajaId}/giros/${giroId}/soporte`, form);
  }

  soporte(cajaId: number, giroId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${cajaId}/giros/${giroId}/soporte`, { responseType: 'blob' });
  }

  pdf(cajaId: number, giroId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${cajaId}/giros/${giroId}/pdf`, { responseType: 'blob' });
  }
}
