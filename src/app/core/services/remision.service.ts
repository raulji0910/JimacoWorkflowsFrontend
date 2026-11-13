import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ConfiguracionEntregas,
  GuardarTipoDocumentoFacturacion,
  RemisionDetalle,
  RemisionTablero,
  TipoDocumentoFacturacion,
  VerificacionSoporte
} from '../models/remision.model';

/** Un archivo del soporte de entrega con el QR que se le leyó en el navegador (null = ninguno). */
export interface ArchivoEntrega {
  archivo: File;
  qrLeido: string | null;
}

@Injectable({ providedIn: 'root' })
export class RemisionService {
  private readonly baseUrl = `${environment.apiUrl}/Remisiones`;

  constructor(private readonly http: HttpClient) {}

  listar(): Observable<RemisionTablero[]> {
    return this.http.get<RemisionTablero[]>(this.baseUrl);
  }

  obtener(id: number): Observable<RemisionDetalle> {
    return this.http.get<RemisionDetalle>(`${this.baseUrl}/${id}`);
  }

  /** PDF (una o varias) como Blob — se abre en una pestaña nueva para imprimir. */
  pdf(ids: number[]): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/pdf`, { params: { ids: ids.join(',') }, responseType: 'blob' });
  }

  /** Revisa UN archivo (QR + IA) antes de confirmar — no guarda nada. */
  verificarSoporte(id: number, archivo: File, qrLeido: string | null): Observable<VerificacionSoporte> {
    const form = new FormData();
    form.append('archivo', archivo, archivo.name);
    if (qrLeido) form.append('qrLeido', qrLeido);
    return this.http.post<VerificacionSoporte>(`${this.baseUrl}/${id}/verificar-soporte`, form);
  }

  confirmarEntrega(id: number, archivos: ArchivoEntrega[], observacion: string): Observable<RemisionDetalle> {
    const form = new FormData();
    for (const a of archivos) {
      form.append('archivos', a.archivo, a.archivo.name);
      form.append('qrLeidos', a.qrLeido ?? '');
    }
    if (observacion.trim()) form.append('observacion', observacion.trim());
    return this.http.post<RemisionDetalle>(`${this.baseUrl}/${id}/confirmar-entrega`, form);
  }

  // ---- Facturación (fase 2, 2026-11-13) ----

  adjuntarDocumento(id: number, tipoDocumentoId: number, archivo: File): Observable<RemisionDetalle> {
    const form = new FormData();
    form.append('tipoDocumentoId', String(tipoDocumentoId));
    form.append('archivo', archivo, archivo.name);
    return this.http.post<RemisionDetalle>(`${this.baseUrl}/${id}/documentos`, form);
  }

  eliminarDocumento(id: number, soporteId: number): Observable<RemisionDetalle> {
    return this.http.delete<RemisionDetalle>(`${this.baseUrl}/${id}/documentos/${soporteId}`);
  }

  enviarAFacturacion(id: number, comentario: string | null): Observable<RemisionDetalle> {
    return this.http.post<RemisionDetalle>(`${this.baseUrl}/${id}/enviar-a-facturacion`, { comentario });
  }

  devolver(id: number, comentario: string): Observable<RemisionDetalle> {
    return this.http.post<RemisionDetalle>(`${this.baseUrl}/${id}/devolver`, { comentario });
  }

  /** Solo administradores. */
  tiposDocumento(): Observable<TipoDocumentoFacturacion[]> {
    return this.http.get<TipoDocumentoFacturacion[]>(`${this.baseUrl}/tipos-documento`);
  }

  guardarTipoDocumento(id: number | null, dto: GuardarTipoDocumentoFacturacion): Observable<TipoDocumentoFacturacion> {
    return id === null
      ? this.http.post<TipoDocumentoFacturacion>(`${this.baseUrl}/tipos-documento`, dto)
      : this.http.put<TipoDocumentoFacturacion>(`${this.baseUrl}/tipos-documento/${id}`, dto);
  }

  /** Solo administradores. */
  configuracion(): Observable<ConfiguracionEntregas> {
    return this.http.get<ConfiguracionEntregas>(`${this.baseUrl}/configuracion`);
  }

  actualizarConfiguracion(dto: { verificacionIAActiva: boolean }): Observable<ConfiguracionEntregas> {
    return this.http.put<ConfiguracionEntregas>(`${this.baseUrl}/configuracion`, dto);
  }

  soporte(soporteId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/soportes/${soporteId}`, { responseType: 'blob' });
  }
}
