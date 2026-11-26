import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SIN_RUEDA } from '../interceptors/loading.interceptor';
import {
  CatalogoCotizacion,
  ConfiguracionDocumentosWO,
  ClienteCatalogo,
  Cotizacion,
  CotizacionResumen,
  DireccionCliente,
  GuardarCotizacion,
  ProductoCatalogo
} from '../models/cotizacion.model';

/** Cotizaciones del portal y catálogo de World Office para armarlas (2026-11-25). */
@Injectable({ providedIn: 'root' })
export class CotizacionService {
  private readonly baseUrl = `${environment.apiUrl}/cotizaciones`;
  private readonly catalogoUrl = `${environment.apiUrl}/catalogo-wo`;
  private readonly sinRueda = { context: new HttpContext().set(SIN_RUEDA, true) };

  constructor(private readonly http: HttpClient) {}

  // ---- Catálogo ----

  catalogo(): Observable<CatalogoCotizacion> {
    return this.http.get<CatalogoCotizacion>(`${this.catalogoUrl}/cotizacion`);
  }

  buscarProductos(buscar: string): Observable<ProductoCatalogo[]> {
    return this.http.get<ProductoCatalogo[]>(`${this.catalogoUrl}/productos`, { params: { buscar }, ...this.sinRueda });
  }

  buscarClientes(buscar: string): Observable<ClienteCatalogo[]> {
    return this.http.get<ClienteCatalogo[]>(`${this.catalogoUrl}/clientes`, { params: { buscar }, ...this.sinRueda });
  }

  direcciones(idTercero: number): Observable<DireccionCliente[]> {
    return this.http.get<DireccionCliente[]>(`${this.catalogoUrl}/clientes/${idTercero}/direcciones`, this.sinRueda);
  }

  // ---- Configuración (solo administradores) ----

  configuracion(): Observable<ConfiguracionDocumentosWO> {
    return this.http.get<ConfiguracionDocumentosWO>(`${this.catalogoUrl}/configuracion`);
  }

  actualizarConfiguracion(dto: { prefijoCotizacion: string; crearCotizacionesEnWorldOffice: boolean }): Observable<ConfiguracionDocumentosWO> {
    return this.http.put<ConfiguracionDocumentosWO>(`${this.catalogoUrl}/configuracion`, dto);
  }

  // ---- Cotizaciones ----

  listar(): Observable<CotizacionResumen[]> {
    return this.http.get<CotizacionResumen[]>(this.baseUrl);
  }

  obtener(id: number, enSegundoPlano = false): Observable<Cotizacion> {
    return this.http.get<Cotizacion>(`${this.baseUrl}/${id}`, enSegundoPlano ? this.sinRueda : {});
  }

  crear(dto: GuardarCotizacion): Observable<Cotizacion> {
    return this.http.post<Cotizacion>(this.baseUrl, dto);
  }

  actualizar(id: number, dto: GuardarCotizacion): Observable<Cotizacion> {
    return this.http.put<Cotizacion>(`${this.baseUrl}/${id}`, dto);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  enviar(id: number): Observable<Cotizacion> {
    return this.http.post<Cotizacion>(`${this.baseUrl}/${id}/enviar`, {});
  }

  copiar(id: number): Observable<Cotizacion> {
    return this.http.post<Cotizacion>(`${this.baseUrl}/${id}/copiar`, {});
  }
}
