import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AccionObservacionFactura,
  AccionObservacionOrden,
  CargaArchivosResultado,
  Conciliacion,
  DetalleFacturaConciliada,
  ObservacionesFactura,
  ObservacionesOrden
} from '../models/conciliacion.model';

@Injectable({ providedIn: 'root' })
export class ConciliacionService {
  private readonly baseUrl = `${environment.apiUrl}/conciliacion`;

  constructor(private readonly http: HttpClient) {}

  // Fechas como 'yyyy-MM-dd' (DateOnly del backend).
  conciliar(desde: string, hasta: string): Observable<Conciliacion> {
    return this.http.get<Conciliacion>(this.baseUrl, { params: { desde, hasta } });
  }

  observaciones(idAsientoContable: number): Observable<ObservacionesOrden> {
    return this.http.get<ObservacionesOrden>(`${this.baseUrl}/ordenes/${idAsientoContable}/observaciones`);
  }

  agregarObservacion(idAsientoContable: number, texto: string, accion: AccionObservacionOrden): Observable<ObservacionesOrden> {
    return this.http.post<ObservacionesOrden>(`${this.baseUrl}/ordenes/${idAsientoContable}/observaciones`, { texto, accion });
  }

  observacionesFactura(facturaId: number): Observable<ObservacionesFactura> {
    return this.http.get<ObservacionesFactura>(`${this.baseUrl}/facturas/${facturaId}/observaciones`);
  }

  agregarObservacionFactura(facturaId: number, texto: string, accion: AccionObservacionFactura): Observable<ObservacionesFactura> {
    return this.http.post<ObservacionesFactura>(`${this.baseUrl}/facturas/${facturaId}/observaciones`, { texto, accion });
  }

  /** XML de una factura o, si son varias, un ZIP con un XML por factura. */
  descargarXml(facturaIds: number[]): Observable<HttpResponse<Blob>> {
    return facturaIds.length === 1
      ? this.http.get(`${this.baseUrl}/facturas/${facturaIds[0]}/xml`, { observe: 'response', responseType: 'blob' })
      : this.http.post(`${this.baseUrl}/facturas/xml`, { facturaIds }, { observe: 'response', responseType: 'blob' });
  }

  obtenerDetalle(facturaId: number): Observable<DetalleFacturaConciliada> {
    return this.http.get<DetalleFacturaConciliada>(`${this.baseUrl}/facturas/${facturaId}`);
  }

  // ZIP/XML descargados de la DIAN, varios en una sola petición. Con eventos para mostrar el avance
  // de la subida.
  cargarArchivos(archivos: File[]): Observable<HttpEvent<CargaArchivosResultado>> {
    const datos = new FormData();
    for (const archivo of archivos) datos.append('archivos', archivo, archivo.name);
    return this.http.post<CargaArchivosResultado>(`${this.baseUrl}/cargar-archivos`, datos, {
      reportProgress: true,
      observe: 'events'
    });
  }
}
