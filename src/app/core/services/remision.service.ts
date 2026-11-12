import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConfiguracionEntregas, RemisionDetalle, RemisionTablero, VerificacionSoporte } from '../models/remision.model';

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
