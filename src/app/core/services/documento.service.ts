import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TOKEN_CORREO } from '../interceptors/auth.interceptor';
import {
  Adjunto,
  DocumentoCrear,
  DocumentoDetalle,
  DocumentoResumen,
  EjecutarAccion,
  ReenvioNotificacionResultado
} from '../models/documento.model';

@Injectable({ providedIn: 'root' })
export class DocumentoService {
  private readonly baseUrl = `${environment.apiUrl}/documentos`;

  constructor(private readonly http: HttpClient) {}

  // El contexto con el token de correo es opcional: cuando no se pasa, el interceptor usa la
  // sesión normal (login por usuario/clave) como siempre.
  private contexto(tokenCorreo?: string): HttpContext | undefined {
    return tokenCorreo ? new HttpContext().set(TOKEN_CORREO, tokenCorreo) : undefined;
  }

  crear(dto: DocumentoCrear): Observable<DocumentoDetalle> {
    return this.http.post<DocumentoDetalle>(this.baseUrl, dto);
  }

  obtener(id: number, tokenCorreo?: string): Observable<DocumentoDetalle> {
    return this.http.get<DocumentoDetalle>(`${this.baseUrl}/${id}`, { context: this.contexto(tokenCorreo) });
  }

  pendientes(): Observable<DocumentoResumen[]> {
    return this.http.get<DocumentoResumen[]>(`${this.baseUrl}/pendientes`);
  }

  mios(): Observable<DocumentoResumen[]> {
    return this.http.get<DocumentoResumen[]>(`${this.baseUrl}/mios`);
  }

  ejecutarAccion(id: number, dto: EjecutarAccion, tokenCorreo?: string): Observable<DocumentoDetalle> {
    return this.http.post<DocumentoDetalle>(`${this.baseUrl}/${id}/acciones`, dto, { context: this.contexto(tokenCorreo) });
  }

  reenviar(id: number): Observable<DocumentoDetalle> {
    return this.http.post<DocumentoDetalle>(`${this.baseUrl}/${id}/reenviar`, {});
  }

  reenviarNotificacion(id: number): Observable<ReenvioNotificacionResultado> {
    return this.http.post<ReenvioNotificacionResultado>(`${this.baseUrl}/${id}/reenviar-notificacion`, {});
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
  obtenerPdf(id: number, tokenCorreo?: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/pdf`, { responseType: 'blob', context: this.contexto(tokenCorreo) });
  }
}
