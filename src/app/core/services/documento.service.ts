import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Adjunto, DocumentoCrear, DocumentoDetalle, DocumentoResumen, EjecutarAccion } from '../models/documento.model';

@Injectable({ providedIn: 'root' })
export class DocumentoService {
  private readonly baseUrl = `${environment.apiUrl}/documentos`;

  constructor(private readonly http: HttpClient) {}

  crear(dto: DocumentoCrear): Observable<DocumentoDetalle> {
    return this.http.post<DocumentoDetalle>(this.baseUrl, dto);
  }

  obtener(id: number): Observable<DocumentoDetalle> {
    return this.http.get<DocumentoDetalle>(`${this.baseUrl}/${id}`);
  }

  pendientes(): Observable<DocumentoResumen[]> {
    return this.http.get<DocumentoResumen[]>(`${this.baseUrl}/pendientes`);
  }

  mios(): Observable<DocumentoResumen[]> {
    return this.http.get<DocumentoResumen[]>(`${this.baseUrl}/mios`);
  }

  ejecutarAccion(id: number, dto: EjecutarAccion): Observable<DocumentoDetalle> {
    return this.http.post<DocumentoDetalle>(`${this.baseUrl}/${id}/acciones`, dto);
  }

  reenviar(id: number): Observable<DocumentoDetalle> {
    return this.http.post<DocumentoDetalle>(`${this.baseUrl}/${id}/reenviar`, {});
  }

  subirAdjunto(id: number, archivo: File): Observable<Adjunto> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    return this.http.post<Adjunto>(`${this.baseUrl}/${id}/adjuntos`, formData);
  }

  // La descarga va autenticada (el controller exige JWT), así que no sirve un <a href> plano
  // — el interceptor solo agrega el header Authorization a peticiones hechas con HttpClient.
  descargarAdjunto(adjuntoId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/adjuntos/${adjuntoId}`, { responseType: 'blob' });
  }

  // Mismo motivo que descargarAdjunto — el PDF también exige JWT, así que se trae como blob y se
  // arma un object URL en el componente en vez de apuntar un <iframe>/<a> directo a la API.
  obtenerPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/pdf`, { responseType: 'blob' });
  }
}
